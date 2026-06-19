#!/usr/bin/env python3
"""
三急 (SanJi) — 状态计算引擎
三色状态灯计算逻辑：基于用户反馈时间序列和运营规则，
为每个厕所计算状态颜色与置信度。
"""

from datetime import datetime, time, timedelta
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass, field
from enum import Enum
import math


# ============================================================
# 枚举与数据结构
# ============================================================

# 配置常量
MALL_DEFAULT_OPEN = time(10, 0)
MALL_DEFAULT_CLOSE = time(22, 0)
METRO_LAST_TRAIN = time(23, 30)
METRO_FIRST_TRAIN = time(6, 0)


class StatusColor(Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class OperatingType(Enum):
    ALWAYS = "24小时"
    FOLLOW_MALL = "跟随商场"
    FIXED = "固定时间"


@dataclass
class FeedbackRecord:
    """单条反馈记录"""
    status: str           # 'available' | 'unavailable'
    created_at: datetime
    cleanliness: Optional[str] = None
    queue: Optional[str] = None
    paper: Optional[str] = None
    trust_score: int = 0


@dataclass
class ToiletInfo:
    """厕所基本信息（用于状态计算）"""
    toilet_id: str
    name: str
    type: str               # 厕所类型
    operating_type: str     # 运营类型
    open_time: Optional[time] = None
    close_time: Optional[time] = None
    # 如果是地铁厕所，是否需要考虑末班车
    is_metro: bool = False
    # 如果是商场厕所，是否需要考虑闭店
    is_mall: bool = False


@dataclass
class StatusResult:
    """状态计算结果"""
    color: StatusColor
    confidence: int         # 0-100
    reason: str             # 计算原因说明
    annotation: str = ""    # 额外标注


# ============================================================
# 核心计算逻辑
# ============================================================

def _is_operating(toilet: ToiletInfo, now: datetime) -> Tuple[bool, str]:
    """
    判断厕所当前是否在运营时间范围内。
    返回 (是否运营中, 原因说明)
    """
    # 24小时
    if toilet.operating_type == OperatingType.ALWAYS.value:
        return True, ""

    # 固定时间
    if toilet.operating_type == OperatingType.FIXED.value:
        if toilet.open_time and toilet.close_time:
            current_time = now.time()
            # 跨夜判断：若 close_time < open_time，说明营业时间跨过午夜
            # 如 22:00-06:00，则当前时间 >= open_time 或 <= close_time 都算运营中
            if toilet.close_time < toilet.open_time:
                if current_time >= toilet.open_time or current_time <= toilet.close_time:
                    return True, ""
                return False, "运营时间外"
            if toilet.open_time <= current_time <= toilet.close_time:
                return True, ""
            return False, "运营时间外"
        return True, ""  # 无时间配置默认运营

    # 跟随商场 (10:00-22:00)
    if toilet.operating_type == OperatingType.FOLLOW_MALL.value:
        current_time = now.time()
        mall_close = toilet.close_time or MALL_DEFAULT_CLOSE
        mall_open = toilet.open_time or MALL_DEFAULT_OPEN
        # 跨夜判断（与固定时间逻辑一致）
        if mall_close < mall_open:
            if current_time >= mall_open or current_time <= mall_close:
                return True, ""
            return False, "商场闭店"
        if mall_open <= current_time <= mall_close:
            return True, ""
        return False, "商场闭店"

    return True, ""


def _metro_ended(toilet: ToiletInfo, now: datetime) -> bool:
    """地铁是否已过末班车（简化：23:30后视为运营结束）"""
    if not toilet.is_metro:
        return False
    return now.time() >= METRO_LAST_TRAIN or now.time() < METRO_FIRST_TRAIN


def calculate_status(
    toilet: ToiletInfo,
    feedbacks: List[FeedbackRecord],
    now: Optional[datetime] = None,
) -> StatusResult:
    """
    三色状态灯计算核心函数。

    Args:
        toilet: 厕所信息
        feedbacks: 该厕所的历史反馈列表（按时间降序排列）
        now: 当前时间（默认 now()）

    Returns:
        StatusResult: 包含颜色、置信度、原因说明
    """
    if now is None:
        now = datetime.now()

    # ---------- Step 1: 运营时间检查 ----------
    is_op, reason = _is_operating(toilet, now)
    if not is_op:
        annotation = ""
        if toilet.is_mall and "闭店" in reason:
            annotation = "商场闭店"
        elif toilet.is_metro:
            annotation = "运营结束"

        return StatusResult(
            color=StatusColor.YELLOW,
            confidence=50,
            reason=reason,
            annotation=annotation,
        )

    # 地铁末班车检查
    if _metro_ended(toilet, now):
        return StatusResult(
            color=StatusColor.YELLOW,
            confidence=50,
            reason="地铁末班车后",
            annotation="运营结束",
        )

    # ---------- Step 2: 基于反馈计算 ----------
    if not feedbacks:
        return StatusResult(
            color=StatusColor.YELLOW,
            confidence=40,
            reason="无反馈数据",
        )

    # 按时间排序（最新在前）
    sorted_fb = sorted(feedbacks, key=lambda f: f.created_at, reverse=True)

    # 合并单次遍历：一次循环统计所有指标
    one_hour_ago = now - timedelta(hours=1)
    five_min_ago = now - timedelta(minutes=5)
    unavailable_1h = []
    recent_5m = []
    available_1h = []
    available_5m = []

    for f in sorted_fb:
        created = f.created_at
        if created >= one_hour_ago:
            if f.status == "unavailable":
                unavailable_1h.append(f)
            elif f.status == "available":
                available_1h.append(f)
                if created >= five_min_ago:
                    available_5m.append(f)
        if created >= five_min_ago:
            recent_5m.append(f)
        else:
            # 已超出1小时范围，无需继续遍历（按时间降序，后续更早）
            if created < one_hour_ago:
                break

    # 最近反馈时间
    latest_feedback = sorted_fb[0]
    hours_since_last = (now - latest_feedback.created_at).total_seconds() / 3600

    # ---------- Step 3: 规则匹配 ----------

    # 规则1: 1h内 ≥3人报告不可用 → RED
    if len(unavailable_1h) >= 3:
        return StatusResult(
            color=StatusColor.RED,
            confidence=85,
            reason=f"1h内{len(unavailable_1h)}人报告不可用",
        )

    # 规则2: 最近5min内有可用反馈 → GREEN (高置信度)
    if available_5m:
        return StatusResult(
            color=StatusColor.GREEN,
            confidence=95,
            reason="5min内有可用反馈",
        )

    # 规则3: 最近1h内有可用反馈 → GREEN (时间衰减置信度)
    if available_1h:
        # 计算衰减：从95降到60，基于最新反馈距今的时间
        minutes_ago = (now - available_1h[0].created_at).total_seconds() / 60
        # 线性衰减: 5分钟=95, 60分钟=60
        confidence = int(95 - (minutes_ago - 5) / 55 * 35)
        confidence = max(60, min(95, confidence))
        return StatusResult(
            color=StatusColor.GREEN,
            confidence=confidence,
            reason=f"1h内有可用反馈，置信度衰减",
        )

    # 规则4: >3h无反馈 → YELLOW
    if hours_since_last > 3:
        return StatusResult(
            color=StatusColor.YELLOW,
            confidence=40,
            reason=f"最近反馈{hours_since_last:.1f}h前",
        )

    # 规则5: 兜底 → YELLOW
    return StatusResult(
        color=StatusColor.YELLOW,
        confidence=50,
        reason="状态不确定",
    )


# ============================================================
# 批量计算 (用于定时任务)
# ============================================================

def batch_calculate(
    toilets: List[ToiletInfo],
    feedbacks_map: Dict[str, List[FeedbackRecord]],
    now: Optional[datetime] = None,
) -> Dict[str, StatusResult]:
    """
    批量计算所有厕所状态。

    Args:
        toilets: 厕所信息列表
        feedbacks_map: {toilet_id: [feedback, ...]} 映射
        now: 当前时间

    Returns:
        {toilet_id: StatusResult} 映射
    """
    if now is None:
        now = datetime.now()

    results = {}
    for toilet in toilets:
        fb_list = feedbacks_map.get(toilet.toilet_id, [])
        results[toilet.toilet_id] = calculate_status(toilet, fb_list, now)

    return results


# ============================================================
# 测试与演示
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("三急状态计算引擎 - 测试")
    print("=" * 60)

    now = datetime.now()

    # 测试案例1: 5min内有可用反馈 → GREEN
    print("\n[案例1] 5min内有可用反馈 → 应返回 GREEN 95")
    toilet1 = ToiletInfo(
        toilet_id="t1", name="IFS 3F 海底捞旁", type="商场厕所",
        operating_type="跟随商场", is_mall=True,
    )
    fb1 = [
        FeedbackRecord(status="available", created_at=now - timedelta(minutes=2)),
        FeedbackRecord(status="available", created_at=now - timedelta(minutes=30)),
    ]
    r1 = calculate_status(toilet1, fb1, now)
    print(f"  结果: {r1.color.value} (置信度: {r1.confidence}) - {r1.reason}")

    # 测试案例2: 1h内≥3人报告不可用 → RED
    print("\n[案例2] 1h内≥3人报告不可用 → 应返回 RED 85")
    toilet2 = ToiletInfo(
        toilet_id="t2", name="春熙路 1F 麦当劳旁", type="公厕",
        operating_type="24小时",
    )
    fb2 = [
        FeedbackRecord(status="unavailable", created_at=now - timedelta(minutes=10)),
        FeedbackRecord(status="unavailable", created_at=now - timedelta(minutes=20)),
        FeedbackRecord(status="unavailable", created_at=now - timedelta(minutes=45)),
        FeedbackRecord(status="available", created_at=now - timedelta(hours=2)),
    ]
    r2 = calculate_status(toilet2, fb2, now)
    print(f"  结果: {r2.color.value} (置信度: {r2.confidence}) - {r2.reason}")

    # 测试案例3: >3h无反馈 → YELLOW
    print("\n[案例3] >3h无反馈 → 应返回 YELLOW 40")
    toilet3 = ToiletInfo(
        toilet_id="t3", name="宽窄巷子 1F 见山书院旁", type="公厕",
        operating_type="24小时",
    )
    fb3 = [
        FeedbackRecord(status="available", created_at=now - timedelta(hours=5)),
    ]
    r3 = calculate_status(toilet3, fb3, now)
    print(f"  结果: {r3.color.value} (置信度: {r3.confidence}) - {r3.reason}")

    # 测试案例4: 商场闭店 → YELLOW
    print("\n[案例4] 商场闭店(凌晨2点) → 应返回 YELLOW 50")
    toilet4 = ToiletInfo(
        toilet_id="t4", name="太古里 B1 方所旁", type="商场厕所",
        operating_type="跟随商场", is_mall=True,
        open_time=time(10, 0), close_time=time(22, 0),
    )
    night = now.replace(hour=2, minute=0, second=0)
    fb4 = [
        FeedbackRecord(status="available", created_at=now - timedelta(hours=5)),
    ]
    r4 = calculate_status(toilet4, fb4, night)
    print(f"  结果: {r4.color.value} (置信度: {r4.confidence}) - {r4.reason}")
    if r4.annotation:
        print(f"  标注: {r4.annotation}")

    # 测试案例5: 地铁末班车后 → YELLOW + 标注
    print("\n[案例5] 地铁末班车后(凌晨0点) → 应返回 YELLOW 50 + 标注'运营结束'")
    toilet5 = ToiletInfo(
        toilet_id="t5", name="天府广场 地铁站 B1", type="地铁厕所",
        operating_type="固定时间", is_metro=True,
        open_time=time(6, 0), close_time=time(23, 30),
    )
    midnight = now.replace(hour=0, minute=30, second=0)
    fb5 = [
        FeedbackRecord(status="available", created_at=now - timedelta(hours=2)),
    ]
    r5 = calculate_status(toilet5, fb5, midnight)
    print(f"  结果: {r5.color.value} (置信度: {r5.confidence}) - {r5.reason}")
    if r5.annotation:
        print(f"  标注: {r5.annotation}")

    # 测试案例6: 1h内可用反馈（衰减）
    print("\n[案例6] 30分钟前可用反馈 → 应返回 GREEN (60-90衰减)")
    toilet6 = ToiletInfo(
        toilet_id="t6", name="天府广场 图书馆 2F", type="公厕",
        operating_type="24小时",
    )
    fb6 = [
        FeedbackRecord(status="available", created_at=now - timedelta(minutes=30)),
        FeedbackRecord(status="available", created_at=now - timedelta(hours=2)),
    ]
    r6 = calculate_status(toilet6, fb6, now)
    print(f"  结果: {r6.color.value} (置信度: {r6.confidence}) - {r6.reason}")

    print("\n" + "=" * 60)
    print("所有测试完成！")
