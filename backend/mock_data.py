#!/usr/bin/env python3
"""
三急 (SanJi) — Mock数据生成脚本
生成150-200个成都核心商圈厕所的Mock数据，输出SQL INSERT脚本。
"""

import random
import uuid
import math
from datetime import datetime, timedelta, time

# ============================================================
# 配置
# ============================================================

OUTPUT_FILE = "mock_data_insert.sql"

# 成都核心商圈 (lat, lng)
DISTRICTS = {
    "春熙路":  (30.658, 104.081),
    "太古里":  (30.655, 104.083),
    "IFS":     (30.658, 104.082),
    "天府广场": (30.658, 104.066),
    "宽窄巷子": (30.666, 104.053),
    "火车东站": (30.631, 104.141),
}

# 厕所类型分布权重
TOILET_TYPE_WEIGHTS = {
    "商场厕所": 35,
    "公厕":     25,
    "地铁厕所": 15,
    "餐饮厕所": 10,
    "公园厕所": 5,
    "酒店厕所": 5,
    "加油站厕所": 3,
    "医院厕所": 2,
}

# 建筑名池
BUILDINGS = {
    "春熙路":  ["春熙路步行街", "伊藤洋华堂", "伊势丹百货", "茂业百货", "群光广场",
               "时代广场", "王府井百货", "春熙坊", "银石广场", "太平洋百货"],
    "太古里":  ["太古里", "博舍酒店", "太古里Apple Store", "太古里方所", "太古里MUJI",
               "太古里星巴克", "太古里Gentle Monster", "太古里%Arabica"],
    "IFS":     ["IFS国际金融中心", "IFS连卡佛", "IFS大食代", "IFS苹果店", "IFS言几又",
               "IFS喜茶", "IFS海底捞", "IFS烤匠"],
    "天府广场": ["天府广场", "四川省图书馆", "四川科技馆", "成都博物馆", "远东百货",
               "摩尔百货", "城市之心", "领地中心"],
    "宽窄巷子": ["宽窄巷子", "窄巷子", "井巷子", "宽坐", "小龙翻大江", "大妙火锅",
               "见山书院", "白夜酒吧", "三联韬奋书店", "宽窄巷子星巴克"],
    "火车东站": ["成都东站", "东站西广场", "东站东广场", "东站长途客运站", "鹏瑞利青羊广场"],
}

# 锚点品牌池
LANDMARKS = [
    "海底捞", "星巴克", "喜茶", "MUJI", "ZARA", "优衣库", "H&M", "西西弗书店",
    "言几又", "大食代", "麦当劳", "肯德基", "必胜客", "Apple Store", "%Arabica",
    "方所", "三联韬奋", "烤匠", "小龙坎", "大妙", "马路边边", "钢管厂五区",
    "711便利店", "全家便利店", "屈臣氏", "名创优品", "泡泡玛特", "乐高",
]

# 运营时间配置
OPERATING_HOURS = {
    "24小时":   (None, None),
    "跟随商场": (time(10, 0), time(22, 0)),
    "固定时间": (time(6, 0), time(23, 0)),
}

ACCESS_TYPE_DIST = [
    ("自由进入", 40),
    ("需安检",   10),
    ("建议消费", 35),
    ("必须消费", 10),
    ("需门禁",   2),
    ("需密码",   2),
    ("需登记",   1),
]

STATUS_DIST = [
    ("green",  80),
    ("yellow", 15),
    ("red",    5),
]

# ============================================================
# 工具函数
# ============================================================

def weighted_choice(choices):
    """带权重的随机选择"""
    total = sum(w for _, w in choices)
    r = random.uniform(0, total)
    upto = 0
    for item, weight in choices:
        if upto + weight >= r:
            return item
        upto += weight
    return choices[-1][0]


def random_offset(base, delta=0.002):
    """在基准坐标上添加随机偏移"""
    return round(base + random.uniform(-delta, delta), 7)


def random_floor():
    """随机楼层"""
    return random.choice(["B2", "B1", "1F", "2F", "3F", "4F", "5F"])


def random_direction(floor, landmark):
    """生成路径指引文字"""
    templates = [
        f"进入{floor}后，沿主通道直行约30米，{landmark}右侧即到",
        f"乘坐电梯至{floor}，出电梯后左转，{landmark}对面",
        f"{floor}扶梯上行后右转，{landmark}旁通道尽头",
        f"从{landmark}正门进入，直行穿过店铺区，左侧洗手间标志处",
        f"{floor}美食区方向，{landmark}隔壁通道内",
    ]
    return random.choice(templates)


def random_status():
    """随机状态（带分布）"""
    return weighted_choice(STATUS_DIST)


def random_confidence(status_color):
    """根据状态生成置信度"""
    if status_color == "green":
        return random.randint(60, 95)
    elif status_color == "yellow":
        return random.randint(30, 60)
    else:
        return random.randint(70, 90)


def pg_escape(s):
    """转义SQL字符串"""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def pg_bool(b):
    return "TRUE" if b else "FALSE"


def pg_time(t):
    if t is None:
        return "NULL"
    return f"'{t.strftime('%H:%M:%S')}'::TIME"


def pg_ts(dt):
    if dt is None:
        return "NULL"
    return f"'{dt.strftime('%Y-%m-%d %H:%M:%S+08')}'::TIMESTAMPTZ"


def pg_point(lat, lng):
    return f"ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)"


# ============================================================
# 数据生成
# ============================================================

def generate_toilet(district, center_lat, center_lng):
    """生成一个厕所记录"""
    tid = uuid.uuid4()

    # 坐标
    lat = random_offset(center_lat)
    lng = random_offset(center_lng)
    entry_lat = random_offset(lat, 0.0003)
    entry_lng = random_offset(lng, 0.0003)

    # 名称
    building = random.choice(BUILDINGS[district])
    floor = random_floor()
    landmark = random.choice(LANDMARKS)
    name = f"{building} {floor} {landmark}旁"

    # 类型
    toilet_type = weighted_choice(list(TOILET_TYPE_WEIGHTS.items()))

    # 设施
    has_baby = random.random() < 0.30
    has_accessible = random.random() < 0.70
    has_paper = random.random() < 0.80
    has_soap = random.random() < 0.60
    has_hand_dryer = random.random() < 0.50

    # 准入
    access = weighted_choice(ACCESS_TYPE_DIST)

    # 运营
    op_type = weighted_choice([("24小时", 50), ("跟随商场", 35), ("固定时间", 15)])
    open_t, close_t = OPERATING_HOURS[op_type]

    # 状态
    status_color = random_status()
    confidence = random_confidence(status_color)

    # 路径
    direction = random_direction(floor, landmark)

    # 贡献者
    contributor_id = f"mock_user_{random.randint(1, 50)}"
    verified = random.random() < 0.40

    # 时间
    days_ago = random.randint(0, 90)
    created_at = datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
    updated_at = created_at + timedelta(days=random.randint(0, days_ago))

    return {
        "id": tid,
        "name": name,
        "type": toilet_type,
        "lat": lat,
        "lng": lng,
        "entry_lat": entry_lat,
        "entry_lng": entry_lng,
        "landmark": landmark,
        "floor": floor,
        "direction": direction,
        "access_type": access,
        "has_baby_station": has_baby,
        "has_accessible": has_accessible,
        "has_squat": random.random() < 0.80,
        "has_seat": random.random() < 0.85,
        "has_paper": has_paper,
        "has_soap": has_soap,
        "has_hand_dryer": has_hand_dryer,
        "operating_type": op_type,
        "open_time": open_t,
        "close_time": close_t,
        "status_color": status_color,
        "status_confidence": confidence,
        "status_updated_at": updated_at,
        "contributor_id": contributor_id,
        "verified": verified,
        "verified_by": f"mock_admin_{random.randint(1, 10)}" if verified else None,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def generate_feedback(toilet, user_open_id):
    """为指定厕所生成一条反馈"""
    days_ago = random.randint(0, 30)
    hours_ago = random.randint(0, 23)
    created_at = datetime.now() - timedelta(days=days_ago, hours=hours_ago)

    # 根据厕所当前状态偏向生成反馈状态
    if toilet["status_color"] == "green":
        f_status = weighted_choice([("available", 85), ("unavailable", 15)])
    elif toilet["status_color"] == "red":
        f_status = weighted_choice([("available", 20), ("unavailable", 80)])
    else:
        f_status = weighted_choice([("available", 50), ("unavailable", 50)])

    cleanliness = weighted_choice([("good", 50), ("ok", 35), ("bad", 15)])
    queue = weighted_choice([("empty", 50), ("few", 35), ("long", 15)])
    paper = weighted_choice([("yes", 60), ("low", 25), ("no", 15)])

    # 用户坐标
    user_lat = random_offset(toilet["lat"], 0.0005)
    user_lng = random_offset(toilet["lng"], 0.0005)
    location_match = random.random() < 0.85

    return {
        "id": uuid.uuid4(),
        "toilet_id": toilet["id"],
        "user_open_id": user_open_id,
        "status": f_status,
        "cleanliness": cleanliness,
        "queue": queue,
        "paper": paper,
        "user_lat": user_lat,
        "user_lng": user_lng,
        "location_match": location_match,
        "trust_score": random.randint(0, 100),
        "created_at": created_at,
    }


def generate_user():
    """生成一个用户"""
    open_id = f"mock_wechat_{uuid.uuid4().hex[:12]}"
    trust = random.randint(40, 95)
    feedback_count = random.randint(0, 50)
    accepted_count = random.randint(0, feedback_count)
    contribute_count = random.randint(0, 10)

    # 角色
    if trust >= 85 and feedback_count >= 30:
        role = random.choice(["L3", "L4"])
    elif trust >= 70 and feedback_count >= 15:
        role = "L2"
    else:
        role = "L1"

    days_ago = random.randint(0, 180)
    created_at = datetime.now() - timedelta(days=days_ago)
    last_active = datetime.now() - timedelta(days=random.randint(0, min(days_ago, 30)))

    return {
        "open_id": open_id,
        "trust_score": trust,
        "feedback_count": feedback_count,
        "accepted_count": accepted_count,
        "contribute_count": contribute_count,
        "role": role,
        "created_at": created_at,
        "last_active_at": last_active,
    }


# ============================================================
# SQL生成
# ============================================================

def toilet_to_sql(t):
    """将厕所dict转为INSERT语句"""
    cols = [
        "id", "name", "type",
        "lat", "lng", "entry_lat", "entry_lng",
        "landmark", "floor", "direction", "access_type",
        "has_baby_station", "has_accessible", "has_squat", "has_seat",
        "has_paper", "has_soap", "has_hand_dryer",
        "operating_type", "open_time", "close_time",
        "status_color", "status_confidence", "status_updated_at",
        "contributor_id", "verified", "verified_by",
        "created_at", "updated_at",
    ]
    vals = [
        pg_escape(str(t["id"])),
        pg_escape(t["name"]),
        pg_escape(t["type"]),
        str(t["lat"]),
        str(t["lng"]),
        str(t["entry_lat"]),
        str(t["entry_lng"]),
        pg_escape(t["landmark"]),
        pg_escape(t["floor"]),
        pg_escape(t["direction"]),
        pg_escape(t["access_type"]),
        pg_bool(t["has_baby_station"]),
        pg_bool(t["has_accessible"]),
        pg_bool(t["has_squat"]),
        pg_bool(t["has_seat"]),
        pg_bool(t["has_paper"]),
        pg_bool(t["has_soap"]),
        pg_bool(t["has_hand_dryer"]),
        pg_escape(t["operating_type"]),
        pg_time(t["open_time"]),
        pg_time(t["close_time"]),
        pg_escape(t["status_color"]),
        str(t["status_confidence"]),
        pg_ts(t["status_updated_at"]),
        pg_escape(t["contributor_id"]),
        pg_bool(t["verified"]),
        pg_escape(t["verified_by"]),
        pg_ts(t["created_at"]),
        pg_ts(t["updated_at"]),
    ]
    return f"INSERT INTO toilets ({', '.join(cols)}) VALUES ({', '.join(vals)});"


def feedback_to_sql(f):
    """将反馈dict转为INSERT语句"""
    cols = [
        "id", "toilet_id", "user_open_id",
        "status", "cleanliness", "queue", "paper",
        "user_lat", "user_lng", "location_match",
        "trust_score", "created_at",
    ]
    vals = [
        pg_escape(str(f["id"])),
        pg_escape(str(f["toilet_id"])),
        pg_escape(f["user_open_id"]),
        pg_escape(f["status"]),
        pg_escape(f["cleanliness"]),
        pg_escape(f["queue"]),
        pg_escape(f["paper"]),
        str(f["user_lat"]),
        str(f["user_lng"]),
        pg_bool(f["location_match"]),
        str(f["trust_score"]),
        pg_ts(f["created_at"]),
    ]
    return f"INSERT INTO feedbacks ({', '.join(cols)}) VALUES ({', '.join(vals)});"


def user_to_sql(u):
    """将用户dict转为INSERT语句"""
    cols = [
        "open_id", "trust_score", "feedback_count", "accepted_count",
        "contribute_count", "role", "created_at", "last_active_at",
    ]
    vals = [
        pg_escape(u["open_id"]),
        str(u["trust_score"]),
        str(u["feedback_count"]),
        str(u["accepted_count"]),
        str(u["contribute_count"]),
        pg_escape(u["role"]),
        pg_ts(u["created_at"]),
        pg_ts(u["last_active_at"]),
    ]
    return f"INSERT INTO users ({', '.join(cols)}) VALUES ({', '.join(vals)});"


def generate_correction(toilet, user_open_id, field, old_val, new_val):
    """生成一条纠错记录"""
    status = weighted_choice([("pending", 50), ("approved", 35), ("rejected", 15)])
    days_ago = random.randint(0, 60)
    created_at = datetime.now() - timedelta(days=days_ago)

    return {
        "id": uuid.uuid4(),
        "toilet_id": toilet["id"],
        "user_open_id": user_open_id,
        "field": field,
        "old_value": old_val,
        "new_value": new_val,
        "status": status,
        "reviewer_id": f"mock_admin_{random.randint(1, 10)}" if status != "pending" else None,
        "review_note": "已核实" if status == "approved" else ("信息不符" if status == "rejected" else None),
        "created_at": created_at,
    }


def correction_to_sql(c):
    """将纠错dict转为INSERT语句"""
    cols = [
        "id", "toilet_id", "user_open_id",
        "field", "old_value", "new_value",
        "status", "reviewer_id", "review_note", "created_at",
    ]
    vals = [
        pg_escape(str(c["id"])),
        pg_escape(str(c["toilet_id"])),
        pg_escape(c["user_open_id"]),
        pg_escape(c["field"]),
        pg_escape(c["old_value"]),
        pg_escape(c["new_value"]),
        pg_escape(c["status"]),
        pg_escape(c["reviewer_id"]),
        pg_escape(c["review_note"]),
        pg_ts(c["created_at"]),
    ]
    return f"INSERT INTO corrections ({', '.join(cols)}) VALUES ({', '.join(vals)});"


# ============================================================
# 主流程
# ============================================================

def main():
    random.seed(42)  # 可复现

    toilets = []
    feedbacks = []
    corrections = []

    # 先生成用户池
    user_pool = [generate_user() for _ in range(80)]

    # 每个区域生成 25-40 个厕所
    for district, (lat, lng) in DISTRICTS.items():
        count = random.randint(25, 40)
        for _ in range(count):
            t = generate_toilet(district, lat, lng)
            toilets.append(t)

            # 随机生成 5-15 条反馈
            fb_count = random.randint(5, 15)
            for _ in range(fb_count):
                user = random.choice(user_pool)
                fb = generate_feedback(t, user["open_id"])
                feedbacks.append(fb)

            # 随机生成 0-3 条纠错
            corr_count = random.randint(0, 3)
            correctable_fields = [
                ("name", t["name"], t["name"] + " (修正)"),
                ("floor", t["floor"], random_floor()),
                ("access_type", t["access_type"], "自由进入"),
                ("has_paper", "true" if t["has_paper"] else "false",
                 "false" if t["has_paper"] else "true"),
            ]
            for _ in range(corr_count):
                field, old_v, new_v = random.choice(correctable_fields)
                user = random.choice(user_pool)
                c = generate_correction(t, user["open_id"], field, old_v, new_v)
                corrections.append(c)

    # 写入SQL文件
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- 三急 (SanJi) — Mock数据 INSERT 脚本")
    lines.append(f"-- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"-- 厕所: {len(toilets)} 条")
    lines.append(f"-- 反馈: {len(feedbacks)} 条")
    lines.append(f"-- 用户: {len(user_pool)} 条")
    lines.append(f"-- 纠错: {len(corrections)} 条")
    lines.append("-- ============================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    lines.append("-- >>> 用户数据")
    for u in user_pool:
        lines.append(user_to_sql(u))
    lines.append("")

    lines.append("-- >>> 厕所数据")
    for t in toilets:
        lines.append(toilet_to_sql(t))
    lines.append("")

    lines.append("-- >>> 反馈数据")
    for fb in feedbacks:
        lines.append(feedback_to_sql(fb))
    lines.append("")

    lines.append("-- >>> 纠错数据")
    for c in corrections:
        lines.append(correction_to_sql(c))
    lines.append("")

    lines.append("COMMIT;")
    lines.append("")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Mock数据生成完成！")
    print(f"  厕所: {len(toilets)} 条")
    print(f"  反馈: {len(feedbacks)} 条")
    print(f"  用户: {len(user_pool)} 条")
    print(f"  纠错: {len(corrections)} 条")
    print(f"  输出文件: {OUTPUT_FILE}")

    # 打印分布统计
    print("\n--- 类型分布 ---")
    type_counts = {}
    for t in toilets:
        type_counts[t["type"]] = type_counts.get(t["type"], 0) + 1
    for k, v in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    print("\n--- 状态分布 ---")
    status_counts = {}
    for t in toilets:
        status_counts[t["status_color"]] = status_counts.get(t["status_color"], 0) + 1
    for k, v in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    print("\n--- 区域分布 ---")
    district_counts = {}
    for t in toilets:
        # 反查区域
        min_dist = float("inf")
        best = "unknown"
        for d, (dlat, dlng) in DISTRICTS.items():
            dist = math.sqrt((t["lat"] - dlat) ** 2 + (t["lng"] - dlng) ** 2)
            if dist < min_dist:
                min_dist = dist
                best = d
        district_counts[best] = district_counts.get(best, 0) + 1
    for k, v in sorted(district_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
