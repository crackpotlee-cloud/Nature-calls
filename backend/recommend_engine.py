#!/usr/bin/env python3
"""
三急 (SanJi) — 推荐算法规则引擎
支持三种推荐场景：智能急、腹泻急、带娃急
"""

from datetime import datetime, time
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass, field
from enum import Enum
import math


# ============================================================
# 枚举与数据结构
# ============================================================

class SceneMode(Enum):
    SMART = "smart"        # 智能急
    DIARRHEA = "diarrhea"  # 腹泻急
    KIDS = "kids"          # 带娃急


@dataclass
class UserContext:
    """用户上下文"""
    lat: float
    lng: float
    current_time: datetime
    # 安全区判断：是否在商业区/地铁站等安全区域
    in_safe_zone: bool = True
    # 夜间模式
    is_night: bool = False
    # 饭点
    is_meal_time: bool = False


@dataclass
class ToiletCandidate:
    """推荐候选厕所"""
    toilet_id: str
    name: str
    type: str
    lat: float
    lng: float
    entry_lat: float
    entry_lng: float

    # 状态
    status_color: str        # green/yellow/red
    status_confidence: int   # 0-100

    # 设施
    has_paper: bool
    has_baby_station: bool
    has_accessible: bool
    has_soap: bool
    has_hand_dryer: bool

    # 准入
    access_type: str

    # 运营
    operating_type: str
    open_time: Optional[time] = None
    close_time: Optional[time] = None

    # 反馈统计
    cleanliness_score: float = 0.5    # 清洁度评分 0-1
    queue_level: float = 0.0          # 排队程度 0-1
    paper_availability: float = 0.5   # 纸巾保证率 0-1
    recent_feedback_count: int = 0

    # 距离（由引擎计算填充）
    distance_m: float = 0.0
    walk_time_min: float = 0.0

    # 最终得分
    final_score: float = 0.0


@dataclass
class RecommendResult:
    """推荐结果"""
    candidates: List[ToiletCandidate]  # 按得分降序排列
    scene: SceneMode
    total_candidates: int
    filtered_count: int                # 被硬筛选过滤的数量


# ============================================================
# 距离计算
# ============================================================

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    使用 Haversine 公式计算两点间球面距离。

    Returns:
        距离（米）
    """
    R = 6371000  # 地球半径（米）

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def estimate_walk_time(distance_m: float) -> float:
    """
    估算步行时间。

    Args:
        distance_m: 距离（米）

    Returns:
        步行时间（分钟），按80m/min估算
    """
    return distance_m / 80.0


# ============================================================
# 硬筛选
# ============================================================

def _apply_hard_filters(
    candidates: List[ToiletCandidate],
    scene: SceneMode,
    context: UserContext,
) -> Tuple[List[ToiletCandidate], int]:
    """
    应用硬筛选条件，返回 (通过筛选的候选, 被过滤数量)
    """
    original_count = len(candidates)
    filtered = []

    for c in candidates:
        # 腹泻急: 必须有纸
        if scene == SceneMode.DIARRHEA and not c.has_paper:
            continue

        # 带娃急: 必须有母婴台
        if scene == SceneMode.KIDS and not c.has_baby_station:
            continue

        # 所有模式: 排除红色状态（已确认不可用）
        if c.status_color == "red":
            continue

        filtered.append(c)

    return filtered, original_count - len(filtered)


# ============================================================
# 评分计算
# ============================================================

def _calc_arrival_score(candidate: ToiletCandidate, context: UserContext) -> float:
    """
    到达时间得分（0-1）
    距离越近得分越高。夜间安全区加成、地铁安检加时。
    """
    # 基础步行时间
    walk_time = candidate.walk_time_min

    # 地铁站额外安检时间
    if candidate.type == "地铁厕所" and candidate.access_type == "需安检":
        walk_time += 2.0  # +2分钟安检

    # 时间到得分映射：0分钟=1.0, 15分钟=0.0, 线性衰减
    score = max(0.0, 1.0 - walk_time / 15.0)

    # 夜间非安全区惩罚
    if context.is_night and not context.in_safe_zone:
        score *= 0.7

    return score


def _calc_availability_score(candidate: ToiletCandidate) -> float:
    """
    可用概率得分（0-1）
    基于状态颜色和置信度。
    """
    if candidate.status_color == "green":
        base = candidate.status_confidence / 100.0
    elif candidate.status_color == "yellow":
        base = candidate.status_confidence / 100.0 * 0.6
    else:
        base = 0.0

    return base


def _calc_quality_score(candidate: ToiletCandidate) -> float:
    """
    质量适配得分（0-1）
    综合清洁度、排队情况。
    """
    cleanliness = candidate.cleanliness_score
    queue_penalty = 1.0 - candidate.queue_level  # 排队越少越好
    return (cleanliness * 0.6 + queue_penalty * 0.4)


def _calc_scene_match_score(candidate: ToiletCandidate, scene: SceneMode) -> float:
    """
    场景匹配得分（0-1）
    根据厕所类型和设施与场景的匹配度。
    """
    score = 0.5

    if scene == SceneMode.SMART:
        # 商场/酒店厕所通常更干净
        if candidate.type in ("商场厕所", "酒店厕所"):
            score += 0.2
        if candidate.has_soap and candidate.has_hand_dryer:
            score += 0.2
        # 自由进入加分
        if candidate.access_type == "自由进入":
            score += 0.1

    elif scene == SceneMode.DIARRHEA:
        # 隐私性：公厕/商场厕所更私密
        if candidate.type in ("商场厕所", "酒店厕所", "餐饮厕所"):
            score += 0.3
        # 有纸加分（但硬筛选已保证有纸）
        if candidate.has_soap:
            score += 0.1

    elif scene == SceneMode.KIDS:
        # 商场厕所对亲子更友好
        if candidate.type in ("商场厕所", "酒店厕所"):
            score += 0.3
        if candidate.has_accessible:
            score += 0.1

    return min(1.0, score)


def _calc_paper_score(candidate: ToiletCandidate) -> float:
    """纸巾保证得分（0-1），腹泻急模式专用"""
    return candidate.paper_availability


def _calc_privacy_score(candidate: ToiletCandidate) -> float:
    """隐私性得分（0-1），腹泻急模式专用"""
    score = 0.5
    if candidate.type in ("商场厕所", "酒店厕所"):
        score = 0.9
    elif candidate.type == "餐饮厕所":
        score = 0.7
    elif candidate.type == "公厕":
        score = 0.4
    return score


def _calc_cleanliness_score(candidate: ToiletCandidate) -> float:
    """清洁度得分（0-1），带娃急模式专用"""
    return candidate.cleanliness_score


def _calc_safety_score(candidate: ToiletCandidate, context: UserContext) -> float:
    """安全区得分（0-1），带娃急模式专用"""
    if context.in_safe_zone:
        return 1.0
    # 非安全区：商业/地铁类型更安全
    if candidate.type in ("商场厕所", "地铁厕所", "酒店厕所"):
        return 0.8
    return 0.5


# ============================================================
# 主推荐函数
# ============================================================

def recommend(
    candidates: List[ToiletCandidate],
    context: UserContext,
    scene: SceneMode = SceneMode.SMART,
    top_k: int = 10,
) -> RecommendResult:
    """
    核心推荐算法。

    Args:
        candidates: 所有候选厕所列表
        context: 用户上下文（位置、时间等）
        scene: 推荐场景模式
        top_k: 返回Top N结果

    Returns:
        RecommendResult: 排序后的推荐结果
    """
    # ---------- Step 1: 硬筛选 ----------
    filtered, removed = _apply_hard_filters(candidates, scene, context)

    # ---------- 降级推荐：全部不可用时，重新纳入最近的 yellow 候选 ----------
    degraded = False
    if len(filtered) == 0:
        # 重新应用场景硬筛选（不排除 red，纳入 yellow）
        fallback = []
        for c in candidates:
            if scene == SceneMode.DIARRHEA and not c.has_paper:
                continue
            if scene == SceneMode.KIDS and not c.has_baby_station:
                continue
            # 纳入 yellow 或 green（排除 red）
            if c.status_color in ("yellow", "green"):
                fallback.append(c)
        if fallback:
            # 按距离排序取最近
            for c in fallback:
                c.distance_m = haversine_distance(context.lat, context.lng, c.entry_lat, c.entry_lng)
            fallback.sort(key=lambda c: c.distance_m)
            filtered = fallback
            degraded = True

    # 如果降级后仍为空，返回空结果
    if len(filtered) == 0:
        return RecommendResult(
            candidates=[],
            scene=scene,
            total_candidates=len(candidates),
            filtered_count=len(candidates),
        )

    # ---------- Step 2: 计算距离和步行时间 ----------
    for c in filtered:
        c.distance_m = haversine_distance(context.lat, context.lng, c.entry_lat, c.entry_lng)
        c.walk_time_min = estimate_walk_time(c.distance_m)

    # ---------- Step 3: 多维度评分 ----------
    for c in filtered:
        arrival = _calc_arrival_score(c, context)
        availability = _calc_availability_score(c)
        quality = _calc_quality_score(c)
        scene_match = _calc_scene_match_score(c, scene)
        paper = _calc_paper_score(c)
        privacy = _calc_privacy_score(c)
        cleanliness = _calc_cleanliness_score(c)
        safety = _calc_safety_score(c, context)

        if scene == SceneMode.SMART:
            # 智能急：基础权重
            # 到达时间40% + 可用概率30% + 质量适配20% + 场景匹配10%
            weights = {
                'arrival': 0.40,
                'availability': 0.30,
                'quality': 0.20,
                'scene_match': 0.10,
                'safety': 0.00,
            }

            # 夜间模式：降低到达时间权重，增加安全区权重
            if context.is_night:
                weights['arrival'] = 0.35
                weights['quality'] = 0.15
                weights['safety'] = 0.10

            # 饭点模式：提高排队/质量权重
            if context.is_meal_time:
                weights['arrival'] = min(weights['arrival'], 0.35)
                weights['availability'] = 0.25
                weights['quality'] = max(weights['quality'], 0.25)
                weights['scene_match'] = max(weights['scene_match'], 0.15)

            # 归一化：确保权重总和为 1.0
            total_w = sum(weights.values())
            if total_w > 0:
                for k in weights:
                    weights[k] /= total_w

            c.final_score = (
                arrival * weights['arrival'] +
                availability * weights['availability'] +
                quality * weights['quality'] +
                scene_match * weights['scene_match'] +
                safety * weights['safety']
            )

        elif scene == SceneMode.DIARRHEA:
            # 腹泻急：到达时间50% + 纸巾保证40% + 隐私性10%
            c.final_score = (
                arrival * 0.50 +
                paper * 0.40 +
                privacy * 0.10
            )

        elif scene == SceneMode.KIDS:
            # 带娃急：清洁度60% + 到达时间20% + 安全区20%
            c.final_score = (
                cleanliness * 0.60 +
                arrival * 0.20 +
                safety * 0.20
            )

    # ---------- Step 4: 排序 ----------
    filtered.sort(key=lambda c: c.final_score, reverse=True)

    return RecommendResult(
        candidates=filtered[:top_k],
        scene=scene,
        total_candidates=len(candidates),
        filtered_count=removed,
    )


# ============================================================
# 测试与演示
# ============================================================

def _make_mock_candidates() -> List[ToiletCandidate]:
    """生成Mock候选数据用于测试"""
    return [
        ToiletCandidate(
            toilet_id="t1", name="IFS 3F 海底捞旁", type="商场厕所",
            lat=30.658, lng=104.082, entry_lat=30.6582, entry_lng=104.0821,
            status_color="green", status_confidence=95,
            has_paper=True, has_baby_station=True, has_accessible=True,
            has_soap=True, has_hand_dryer=True,
            access_type="自由进入", operating_type="跟随商场",
            cleanliness_score=0.9, queue_level=0.2, paper_availability=0.9,
            recent_feedback_count=15,
        ),
        ToiletCandidate(
            toilet_id="t2", name="太古里 B1 方所旁", type="商场厕所",
            lat=30.655, lng=104.083, entry_lat=30.6551, entry_lng=104.0832,
            status_color="green", status_confidence=80,
            has_paper=True, has_baby_station=True, has_accessible=False,
            has_soap=True, has_hand_dryer=False,
            access_type="自由进入", operating_type="跟随商场",
            cleanliness_score=0.85, queue_level=0.3, paper_availability=0.8,
            recent_feedback_count=10,
        ),
        ToiletCandidate(
            toilet_id="t3", name="春熙路步行街 公厕", type="公厕",
            lat=30.6585, lng=104.080, entry_lat=30.6586, entry_lng=104.0801,
            status_color="yellow", status_confidence=50,
            has_paper=False, has_baby_station=False, has_accessible=True,
            has_soap=False, has_hand_dryer=False,
            access_type="自由进入", operating_type="24小时",
            cleanliness_score=0.4, queue_level=0.5, paper_availability=0.1,
            recent_feedback_count=3,
        ),
        ToiletCandidate(
            toilet_id="t4", name="天府广场 地铁站 B1", type="地铁厕所",
            lat=30.658, lng=104.066, entry_lat=30.6581, entry_lng=104.0662,
            status_color="green", status_confidence=90,
            has_paper=True, has_baby_station=False, has_accessible=True,
            has_soap=True, has_hand_dryer=True,
            access_type="需安检", operating_type="固定时间",
            cleanliness_score=0.7, queue_level=0.6, paper_availability=0.7,
            recent_feedback_count=8,
        ),
        ToiletCandidate(
            toilet_id="t5", name="宽窄巷子 大妙火锅旁", type="餐饮厕所",
            lat=30.666, lng=104.053, entry_lat=30.6661, entry_lng=104.0531,
            status_color="green", status_confidence=85,
            has_paper=True, has_baby_station=False, has_accessible=False,
            has_soap=True, has_hand_dryer=True,
            access_type="建议消费", operating_type="固定时间",
            cleanliness_score=0.75, queue_level=0.4, paper_availability=0.8,
            recent_feedback_count=6,
        ),
        ToiletCandidate(
            toilet_id="t6", name="火车东站 西广场 公厕", type="公厕",
            lat=30.631, lng=104.140, entry_lat=30.6311, entry_lng=104.1402,
            status_color="red", status_confidence=85,
            has_paper=False, has_baby_station=False, has_accessible=True,
            has_soap=False, has_hand_dryer=False,
            access_type="自由进入", operating_type="24小时",
            cleanliness_score=0.2, queue_level=0.8, paper_availability=0.0,
            recent_feedback_count=5,
        ),
    ]


if __name__ == "__main__":
    print("=" * 60)
    print("三急推荐算法规则引擎 - 测试")
    print("=" * 60)

    candidates = _make_mock_candidates()

    # 用户上下文：IFS附近，下午3点
    context_day = UserContext(
        lat=30.658, lng=104.082,
        current_time=datetime.now().replace(hour=15),
        in_safe_zone=True, is_night=False, is_meal_time=False,
    )

    # 用户上下文：夜间，饭点
    context_night = UserContext(
        lat=30.658, lng=104.082,
        current_time=datetime.now().replace(hour=20),
        in_safe_zone=True, is_night=True, is_meal_time=True,
    )

    # ---- 智能急模式 ----
    print("\n[场景1] 智能急模式 (白天, IFS附近)")
    r1 = recommend(candidates, context_day, SceneMode.SMART, top_k=5)
    print(f"  总候选: {r1.total_candidates}, 过滤: {r1.filtered_count}")
    for i, c in enumerate(r1.candidates):
        print(f"  #{i+1} {c.name} — 得分: {c.final_score:.3f} "
              f"距离: {c.distance_m:.0f}m 步行: {c.walk_time_min:.1f}min")

    print("\n[场景1b] 智能急模式 (夜间+饭点, IFS附近)")
    r1b = recommend(candidates, context_night, SceneMode.SMART, top_k=5)
    print(f"  总候选: {r1b.total_candidates}, 过滤: {r1b.filtered_count}")
    for i, c in enumerate(r1b.candidates):
        print(f"  #{i+1} {c.name} — 得分: {c.final_score:.3f} "
              f"距离: {c.distance_m:.0f}m 步行: {c.walk_time_min:.1f}min")

    # ---- 腹泻急模式 ----
    print("\n[场景2] 腹泻急模式 (硬筛选: has_paper=true)")
    r2 = recommend(candidates, context_day, SceneMode.DIARRHEA, top_k=5)
    print(f"  总候选: {r2.total_candidates}, 过滤: {r2.filtered_count}")
    for i, c in enumerate(r2.candidates):
        print(f"  #{i+1} {c.name} — 得分: {c.final_score:.3f} "
              f"有纸: {c.has_paper} 距离: {c.distance_m:.0f}m")

    # ---- 带娃急模式 ----
    print("\n[场景3] 带娃急模式 (硬筛选: has_baby_station=true)")
    r3 = recommend(candidates, context_day, SceneMode.KIDS, top_k=5)
    print(f"  总候选: {r3.total_candidates}, 过滤: {r3.filtered_count}")
    for i, c in enumerate(r3.candidates):
        print(f"  #{i+1} {c.name} — 得分: {c.final_score:.3f} "
              f"母婴台: {c.has_baby_station} 清洁度: {c.cleanliness_score:.1f}")

    print("\n" + "=" * 60)
    print("所有测试完成！")
