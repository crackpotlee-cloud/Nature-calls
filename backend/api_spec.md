# 三急 (SanJi) API 接口文档

> 版本: v1.0.0  
> Base URL: `https://api.sanji.app/v1`  
> 认证方式: 微信小程序登录，Header `Authorization: Bearer <token>`

---

## 通用说明

### 响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1718697600
}
```

### 错误码
| code | 说明 |
|------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1002 | 认证失败 |
| 1003 | 权限不足 |
| 1004 | 资源不存在 |
| 2001 | 推荐引擎异常 |
| 3001 | 状态计算异常 |

---

## 一、厕所查询

### 1. 附近厕所搜索
```
GET /toilets/nearby
```

**描述**: 基于用户位置，搜索附近N公里内的厕所列表。

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lat | float | 是 | 用户纬度 |
| lng | float | 是 | 用户经度 |
| radius | int | 否 | 搜索半径（米），默认2000，最大5000 |
| type | string | 否 | 厕所类型筛选，逗号分隔 |
| status | string | 否 | 状态筛选: green/yellow/red |
| has_baby | bool | 否 | 是否有母婴台 |
| has_paper | bool | 否 | 是否有纸 |
| page | int | 否 | 页码，默认1 |
| page_size | int | 否 | 每页条数，默认20，最大50 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "total": 45,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "id": "uuid",
        "name": "IFS 3F 海底捞旁",
        "type": "商场厕所",
        "lat": 30.6580000,
        "lng": 104.0820000,
        "entry_lat": 30.6582000,
        "entry_lng": 104.0821000,
        "landmark": "海底捞",
        "floor": "3F",
        "direction": "进入3F后，沿主通道直行约30米，海底捞右侧即到",
        "access_type": "自由进入",
        "has_baby_station": true,
        "has_accessible": true,
        "has_paper": true,
        "has_soap": true,
        "has_hand_dryer": true,
        "operating_type": "跟随商场",
        "open_time": "10:00:00",
        "close_time": "22:00:00",
        "status_color": "green",
        "status_confidence": 95,
        "distance_m": 120,
        "walk_time_min": 1.5
      }
    ]
  }
}
```

### 2. 厕所详情
```
GET /toilets/{id}
```

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 厕所UUID |

**响应**:
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "IFS 3F 海底捞旁",
    "type": "商场厕所",
    "lat": 30.6580000,
    "lng": 104.0820000,
    "entry_lat": 30.6582000,
    "entry_lng": 104.0821000,
    "landmark": "海底捞",
    "floor": "3F",
    "direction": "进入3F后，沿主通道直行约30米，海底捞右侧即到",
    "access_type": "自由进入",
    "facilities": {
      "baby_station": true,
      "accessible": true,
      "squat": true,
      "seat": true,
      "paper": true,
      "soap": true,
      "hand_dryer": true
    },
    "operation": {
      "type": "跟随商场",
      "open_time": "10:00:00",
      "close_time": "22:00:00",
      "is_operating": true
    },
    "status": {
      "color": "green",
      "confidence": 95,
      "updated_at": "2025-06-18T10:30:00+08:00"
    },
    "stats": {
      "feedback_count": 42,
      "cleanliness_good_rate": 0.85,
      "queue_empty_rate": 0.60
    },
    "meta": {
      "verified": true,
      "contributor_id": "user_xxx",
      "created_at": "2025-01-15T08:00:00+08:00"
    }
  }
}
```

### 3. 按区域查询厕所
```
GET /toilets/by-district
```

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| district | string | 是 | 区域名: 春熙路/太古里/IFS/天府广场/宽窄巷子/火车东站 |
| page | int | 否 | 页码 |
| page_size | int | 否 | 每页条数 |

---

## 二、智能推荐

### 4. 智能推荐厕所
```
POST /recommend
```

**描述**: 根据用户位置和场景，智能推荐最优厕所。

**请求体**:
```json
{
  "lat": 30.658,
  "lng": 104.082,
  "scene": "smart",
  "radius": 2000,
  "top_k": 5
}
```

**scene 说明**:
| 值 | 说明 |
|------|------|
| smart | 智能急模式（默认） |
| diarrhea | 腹泻急模式 |
| kids | 带娃急模式 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "scene": "smart",
    "context": {
      "is_night": false,
      "is_meal_time": false,
      "in_safe_zone": true
    },
    "total_candidates": 45,
    "filtered_count": 2,
    "recommendations": [
      {
        "rank": 1,
        "toilet_id": "uuid",
        "name": "IFS 3F 海底捞旁",
        "type": "商场厕所",
        "status_color": "green",
        "distance_m": 120,
        "walk_time_min": 1.5,
        "score": 0.925,
        "score_breakdown": {
          "arrival": 0.90,
          "availability": 0.95,
          "quality": 0.88,
          "scene_match": 0.90
        },
        "highlights": ["母婴台", "无障碍", "有纸巾"],
        "direction": "进入3F后，沿主通道直行约30米，海底捞右侧即到"
      }
    ]
  }
}
```

### 5. 推荐场景切换
```
POST /recommend/switch-scene
```

**描述**: 切换推荐场景并立即返回新结果。

**请求体**:
```json
{
  "lat": 30.658,
  "lng": 104.082,
  "from_scene": "smart",
  "to_scene": "diarrhea"
}
```

---

## 三、反馈系统

### 6. 提交反馈
```
POST /feedbacks
```

**请求体**:
```json
{
  "toilet_id": "uuid",
  "status": "available",
  "cleanliness": "good",
  "queue": "empty",
  "paper": "yes",
  "user_lat": 30.6581,
  "user_lng": 104.0821
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "feedback_id": "uuid",
    "trust_score_earned": 2,
    "new_user_trust": 72
  }
}
```

### 7. 获取厕所反馈列表
```
GET /feedbacks/toilet/{toilet_id}
```

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| toilet_id | string | 是 | 厕所UUID |
| page | int | 否 | 页码 |
| page_size | int | 否 | 每页条数 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "total": 42,
    "stats": {
      "available_rate": 0.88,
      "cleanliness_good_rate": 0.85,
      "queue_empty_rate": 0.60,
      "paper_yes_rate": 0.78
    },
    "items": [
      {
        "id": "uuid",
        "user_open_id": "user_xxx",
        "status": "available",
        "cleanliness": "good",
        "queue": "empty",
        "paper": "yes",
        "trust_score": 85,
        "created_at": "2025-06-18T10:30:00+08:00"
      }
    ]
  }
}
```

### 8. 获取用户反馈历史
```
GET /feedbacks/user/me
```

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码 |
| page_size | int | 否 | 每页条数 |

---

## 四、用户系统

### 9. 微信登录
```
POST /auth/login
```

**请求体**:
```json
{
  "code": "wx_auth_code"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "token": "jwt_token_xxx",
    "user": {
      "open_id": "user_xxx",
      "trust_score": 60,
      "role": "L1",
      "feedback_count": 0,
      "contribute_count": 0,
      "is_new": true
    }
  }
}
```

### 10. 获取用户信息
```
GET /users/me
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "open_id": "user_xxx",
    "trust_score": 72,
    "role": "L2",
    "feedback_count": 25,
    "accepted_count": 20,
    "contribute_count": 3,
    "created_at": "2025-01-15T08:00:00+08:00",
    "last_active_at": "2025-06-18T10:30:00+08:00",
    "badges": ["诚信反馈者", "厕所猎人"]
  }
}
```

### 11. 获取用户贡献统计
```
GET /users/me/stats
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "total_feedbacks": 25,
    "feedback_accept_rate": 0.80,
    "total_contributions": 3,
    "corrections_submitted": 5,
    "corrections_approved": 3,
    "trust_score_history": [
      {"date": "2025-01", "score": 60},
      {"date": "2025-02", "score": 65},
      {"date": "2025-03", "score": 72}
    ]
  }
}
```

---

## 五、纠错系统

### 12. 提交纠错
```
POST /corrections
```

**请求体**:
```json
{
  "toilet_id": "uuid",
  "field": "has_paper",
  "old_value": "false",
  "new_value": "true"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "correction_id": "uuid",
    "status": "pending"
  }
}
```

### 13. 获取我的纠错记录
```
GET /corrections/user/me
```

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态筛选: pending/approved/rejected |
| page | int | 否 | 页码 |

---

## 六、状态系统

### 14. 获取厕所实时状态
```
GET /status/{toilet_id}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "toilet_id": "uuid",
    "color": "green",
    "confidence": 95,
    "reason": "5min内有可用反馈",
    "annotation": "",
    "updated_at": "2025-06-18T10:30:00+08:00",
    "recent_feedbacks": {
      "last_1h_available": 3,
      "last_1h_unavailable": 0,
      "last_feedback_at": "2025-06-18T10:28:00+08:00"
    }
  }
}
```

### 15. 批量获取状态
```
POST /status/batch
```

**请求体**:
```json
{
  "toilet_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "statuses": {
      "uuid1": {"color": "green", "confidence": 95},
      "uuid2": {"color": "yellow", "confidence": 50},
      "uuid3": {"color": "red", "confidence": 85}
    }
  }
}
```

---

## 七、导航系统

### 16. 获取导航步骤
```
POST /nav/steps
```

**描述**: 根据厕所ID获取室内导航步骤指引。

**请求体**:
```json
{
  "toilet_id": "uuid"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "toilet_id": "uuid",
    "steps": [
      "导航至IFS商场3号门",
      "进入后找到3号电梯",
      "乘电梯至3楼",
      "出电梯右转",
      "海底捞门口旁通道进入"
    ]
  }
}
```

---

## 八、厕所贡献

### 17. 贡献厕所
```
POST /toilet/contribute
```

**描述**: 用户提交新厕所数据，进入审核队列。

**请求体**:
```json
{
  "location": {
    "lat": 30.6580,
    "lng": 104.0820,
    "address": "IFS商场3楼"
  },
  "name": "IFS 3F 海底捞旁",
  "type": "商场厕所",
  "landmark": "海底捞",
  "floor": "3F",
  "direction": "进入3F后，沿主通道直行约30米，海底捞右侧即到",
  "access_type": "自由进入",
  "facilities": {
    "seat": true,
    "squat": true,
    "accessible": true,
    "baby_station": false,
    "paper": true,
    "soap": true,
    "hand_dryer": false
  }
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "toilet_id": "uuid",
    "status": "pending",
    "message": "已提交审核"
  }
}
```

---

## 九、快速确认

### 18. 确认厕所状态
```
POST /feedback/confirm
```

**描述**: 分享落地页快速确认厕所状态（轻量反馈）。

**请求体**:
```json
{
  "toilet_id": "uuid",
  "is_available": true
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "confirmed": true,
    "toilet_id": "uuid",
    "status": "available",
    "trust_score_earned": 1
  }
}
```

---

## 附录

### A. 数据字典

#### 厕所类型 (type)
| 值 | 说明 |
|------|------|
| 公厕 | 市政公共厕所 |
| 商场厕所 | 购物中心内厕所 |
| 地铁厕所 | 地铁站内厕所 |
| 餐饮厕所 | 餐饮店内厕所 |
| 公园厕所 | 公园内厕所 |
| 加油站厕所 | 加油站厕所 |
| 酒店厕所 | 酒店内厕所 |
| 医院厕所 | 医院内厕所 |

#### 准入类型 (access_type)
| 值 | 说明 |
|------|------|
| 自由进入 | 无需任何条件 |
| 需安检 | 需要经过安检（如地铁） |
| 建议消费 | 建议消费但非强制 |
| 必须消费 | 必须消费才能使用 |
| 需门禁 | 需要门禁卡/刷卡 |
| 需密码 | 需要密码 |
| 需登记 | 需要登记信息 |

#### 运营类型 (operating_type)
| 值 | 说明 |
|------|------|
| 24小时 | 全天候运营 |
| 跟随商场 | 跟随商场营业时间 |
| 固定时间 | 固定开放时间 |

#### 用户角色 (role)
| 值 | 条件 | 说明 |
|------|------|------|
| L1 | trust >= 0 | 普通用户 |
| L2 | trust >= 70, feedback >= 15 | 活跃用户 |
| L3 | trust >= 85, feedback >= 30 | 资深用户 |
| L4 | trust >= 90, feedback >= 50 | 核心贡献者 |

### B. 频率限制
| 接口 | 限制 |
|------|------|
| 附近搜索 | 30次/分钟/用户 |
| 提交反馈 | 20次/分钟/用户 |
| 提交纠错 | 10次/分钟/用户 |
| 推荐请求 | 30次/分钟/用户 |

### C. 状态计算触发时机
1. 新反馈提交后异步触发
2. 定时任务每5分钟全量刷新
3. 运营时间变更后触发
4. 用户主动查询时缓存失效触发
