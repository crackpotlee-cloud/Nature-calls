/**
 * API 调用封装
 * 当前使用 Mock 数据，后续接入后端 API
 * 数据结构已与 backend/api_spec.md v1.0.0 对齐
 */

// ===== 环境配置 =====
// 开发环境与生产环境使用不同 BASE_URL
// 可通过微信小程序 app.json 或环境变量切换
const ENV = {
  development: 'https://api-dev.sanji.app/v1',
  production: 'https://api.sanji.app/v1'
}
// TODO: 生产部署前切换为 ENV.production
const BASE_URL = ENV.development

// 引入地图工具函数（用于动态计算距离）
const mapUtil = require('./map')

// ===== Mock 数据（与后端API文档严格对齐） =====

// 基础厕所数据 — 仅包含POI坐标和属性，不包含距离/步行时间等动态数据
const MOCK_TOILET_DETAILS = [
  {
    id: 'toilet_001',
    name: 'IFS 3F 海底捞旁',
    type: '商场厕所',
    lat: 30.6580,
    lng: 104.0820,
    entry_lat: 30.6582,
    entry_lng: 104.0821,
    landmark: '海底捞',
    floor: '3F',
    direction: '进入3F后，沿主通道直行约30米，海底捞右侧即到',
    access_type: '自由进入',
    facilities: {
      baby_station: false,
      accessible: true,
      squat: true,
      seat: true,
      paper: true,
      soap: true,
      hand_dryer: false
    },
    operation: {
      type: '跟随商场',
      open_time: '10:00:00',
      close_time: '22:00:00',
      is_operating: true
    },
    status: {
      color: 'green',
      confidence: 95,
      updated_at: '2025-06-18T10:30:00+08:00'
    },
    stats: {
      feedback_count: 42,
      cleanliness_good_rate: 0.85,
      queue_empty_rate: 0.60
    },
    meta: {
      verified: true,
      contributor_id: 'user_001',
      created_at: '2025-01-15T08:00:00+08:00'
    }
  },
  {
    id: 'toilet_002',
    name: '星巴克（IFS店）',
    type: '餐饮厕所',
    lat: 30.6583,
    lng: 104.0815,
    entry_lat: 30.6583,
    entry_lng: 104.0815,
    landmark: '星巴克',
    floor: '1F',
    direction: '进入星巴克后，直行到店铺深处右转',
    access_type: '建议消费',
    facilities: {
      baby_station: false,
      accessible: true,
      squat: true,
      seat: true,
      paper: true,
      soap: true,
      hand_dryer: true
    },
    operation: {
      type: '固定时间',
      open_time: '07:00:00',
      close_time: '23:00:00',
      is_operating: true
    },
    status: {
      color: 'yellow',
      confidence: 50,
      updated_at: '2025-06-18T09:15:00+08:00'
    },
    stats: {
      feedback_count: 18,
      cleanliness_good_rate: 0.80,
      queue_empty_rate: 0.50
    },
    meta: {
      verified: true,
      contributor_id: 'user_002',
      created_at: '2025-02-20T10:00:00+08:00'
    }
  },
  {
    id: 'toilet_003',
    name: '麦当劳（春熙路店）',
    type: '餐饮厕所',
    lat: 30.6570,
    lng: 104.0830,
    entry_lat: 30.6570,
    entry_lng: 104.0830,
    landmark: '麦当劳',
    floor: '1F',
    direction: '进入麦当劳后，向左边走到尽头',
    access_type: '建议消费',
    facilities: {
      baby_station: true,
      accessible: true,
      squat: true,
      seat: true,
      paper: false,
      soap: true,
      hand_dryer: true
    },
    operation: {
      type: '固定时间',
      open_time: '06:00:00',
      close_time: '24:00:00',
      is_operating: true
    },
    status: {
      color: 'green',
      confidence: 88,
      updated_at: '2025-06-18T08:45:00+08:00'
    },
    stats: {
      feedback_count: 30,
      cleanliness_good_rate: 0.75,
      queue_empty_rate: 0.80
    },
    meta: {
      verified: true,
      contributor_id: 'user_003',
      created_at: '2025-03-10T12:00:00+08:00'
    }
  },
  {
    id: 'toilet_004',
    name: '春熙路公厕',
    type: '公厕',
    lat: 30.6550,
    lng: 104.0810,
    entry_lat: 30.6550,
    entry_lng: 104.0810,
    landmark: '春熙路步行街',
    floor: '1F',
    direction: '沿春熙路步行街向南，到达路口右转',
    access_type: '自由进入',
    facilities: {
      baby_station: false,
      accessible: true,
      squat: true,
      seat: false,
      paper: false,
      soap: false,
      hand_dryer: false
    },
    operation: {
      type: '24小时',
      open_time: '00:00:00',
      close_time: '23:59:00',
      is_operating: true
    },
    status: {
      color: 'green',
      confidence: 82,
      updated_at: '2025-06-18T07:30:00+08:00'
    },
    stats: {
      feedback_count: 55,
      cleanliness_good_rate: 0.45,
      queue_empty_rate: 0.70
    },
    meta: {
      verified: true,
      contributor_id: 'user_004',
      created_at: '2024-11-05T09:00:00+08:00'
    }
  },
  {
    id: 'toilet_005',
    name: '太古里 2F 母婴室',
    type: '商场厕所',
    lat: 30.6600,
    lng: 104.0800,
    entry_lat: 30.6600,
    entry_lng: 104.0800,
    landmark: '太古里Apple Store',
    floor: '2F',
    direction: '进入太古里商场，乘电梯到2楼，母婴室在休息区旁',
    access_type: '自由进入',
    facilities: {
      baby_station: true,
      accessible: true,
      squat: true,
      seat: true,
      paper: true,
      soap: true,
      hand_dryer: true
    },
    operation: {
      type: '跟随商场',
      open_time: '10:00:00',
      close_time: '22:00:00',
      is_operating: true
    },
    status: {
      color: 'green',
      confidence: 96,
      updated_at: '2025-06-18T10:00:00+08:00'
    },
    stats: {
      feedback_count: 25,
      cleanliness_good_rate: 0.92,
      queue_empty_rate: 0.85
    },
    meta: {
      verified: true,
      contributor_id: 'user_005',
      created_at: '2025-04-01T14:00:00+08:00'
    }
  },
  {
    id: 'toilet_006',
    name: '达州中心广场公厕',
    type: '公厕',
    lat: 31.2090,
    lng: 107.5010,
    entry_lat: 31.2092,
    entry_lng: 107.5012,
    landmark: '中心广场',
    floor: '1F',
    direction: '达州市通川区中心广场西南角，靠近公交站台',
    access_type: '自由进入',
    facilities: {
      baby_station: false,
      accessible: true,
      squat: true,
      seat: false,
      paper: false,
      soap: false,
      hand_dryer: false
    },
    operation: {
      type: '24小时',
      open_time: '00:00:00',
      close_time: '23:59:00',
      is_operating: true
    },
    status: {
      color: 'green',
      confidence: 75,
      updated_at: '2025-06-18T09:00:00+08:00'
    },
    stats: {
      feedback_count: 12,
      cleanliness_good_rate: 0.55,
      queue_empty_rate: 0.70
    },
    meta: {
      verified: true,
      contributor_id: 'user_006',
      created_at: '2025-03-20T10:00:00+08:00'
    }
  },
  {
    id: 'toilet_007',
    name: '达州罗浮广场 2F 厕所',
    type: '商场厕所',
    lat: 31.2080,
    lng: 107.4990,
    entry_lat: 31.2082,
    entry_lng: 107.4992,
    landmark: '罗浮广场',
    floor: '2F',
    direction: '进入罗浮广场，乘扶梯至2楼，厕所在中国电影票房旁通道',
    access_type: '自由进入',
    facilities: {
      baby_station: true,
      accessible: true,
      squat: true,
      seat: true,
      paper: true,
      soap: true,
      hand_dryer: false
    },
    operation: {
      type: '跟随商场',
      open_time: '09:00:00',
      close_time: '22:00:00',
      is_operating: true
    },
    status: {
      color: 'green',
      confidence: 88,
      updated_at: '2025-06-18T10:15:00+08:00'
    },
    stats: {
      feedback_count: 18,
      cleanliness_good_rate: 0.82,
      queue_empty_rate: 0.78
    },
    meta: {
      verified: true,
      contributor_id: 'user_007',
      created_at: '2025-04-15T12:00:00+08:00'
    }
  }
]

// 附近搜索用扁平结构（与后端 GET /toilets/nearby 响应一致）
// 距离和步行时间由前端根据真实坐标动态计算，不再写死
// 移除 NEARBY_EXTRA 硬编码，所有距离/时间均实时计算

function detailToNearbyItem(detail, userLat, userLng) {
  // 根据用户真实坐标动态计算距离
  const distance_m = mapUtil.getDistance(userLat, userLng, detail.lat, detail.lng)
  const walk_time_min = Math.max(1, Math.round(distance_m / 80)) // 80m/min
  return {
    id: detail.id,
    name: detail.name,
    type: detail.type,
    lat: detail.lat,
    lng: detail.lng,
    entry_lat: detail.entry_lat,
    entry_lng: detail.entry_lng,
    landmark: detail.landmark,
    floor: detail.floor,
    direction: detail.direction,
    access_type: detail.access_type,
    has_baby_station: detail.facilities.baby_station,
    has_accessible: detail.facilities.accessible,
    has_paper: detail.facilities.paper,
    has_soap: detail.facilities.soap,
    has_hand_dryer: detail.facilities.hand_dryer,
    operating_type: detail.operation.type,
    open_time: detail.operation.open_time,
    close_time: detail.operation.close_time,
    status_color: detail.status.color,
    status_confidence: detail.status.confidence,
    distance_m: distance_m,
    walk_time_min: walk_time_min
  }
}

// 推荐用数据（与后端 POST /recommend 响应一致）
// score 和 score_breakdown 由前端根据规则动态计算（Mock阶段模拟后端推荐引擎）
function detailToRecommendation(detail, distance_m, walk_time_min, rank, scene) {
  // 动态计算推荐分数 (模拟后端 recommend_engine.py 逻辑)
  // 基础分: 距离越近分越高 (距离因子 40%)
  const maxDist = 2000
  const distanceScore = Math.max(0, 1 - distance_m / maxDist)
  // 状态分: green=1.0, yellow=0.6, red=0 (状态因子 30%)
  const statusScoreMap = { green: 1.0, yellow: 0.6, red: 0.0 }
  const statusScore = statusScoreMap[detail.status.color] || 0.5
  // 质量分: 有纸+有肥皂加分 (质量因子 20%)
  const qualityScore = (
    (detail.facilities.paper ? 0.3 : 0) +
    (detail.facilities.soap ? 0.2 : 0) +
    (detail.facilities.baby_station ? 0.2 : 0) +
    (detail.facilities.accessible ? 0.1 : 0)
  )
  // 场景匹配分 (场景因子 10%)
  let sceneScore = 0.5
  if (scene === 'diarrhea' && detail.facilities.paper) sceneScore = 1.0
  if (scene === 'kids' && detail.facilities.baby_station) sceneScore = 1.0

  const finalScore = Math.min(0.99, Math.max(0.3,
    distanceScore * 0.4 +
    statusScore * 0.3 +
    qualityScore * 0.2 +
    sceneScore * 0.1
  ))

  return {
    rank,
    toilet_id: detail.id,
    name: detail.name,
    type: detail.type,
    lat: detail.lat,
    lng: detail.lng,
    entry_lat: detail.entry_lat,
    entry_lng: detail.entry_lng,
    landmark: detail.landmark,
    floor: detail.floor,
    direction: detail.direction,
    access_type: detail.access_type,
    status_color: detail.status.color,
    distance_m: distance_m,
    walk_time_min: walk_time_min,
    score: Math.round(finalScore * 1000) / 1000,
    score_breakdown: {
      arrival: Math.round(distanceScore * 100),
      availability: Math.round(statusScore * 100),
      quality: Math.round(qualityScore * 100),
      scene_match: Math.round(sceneScore * 100)
    },
    highlights: detail.facilities.paper ? ['干净', '有纸'] : ['24小时', '自由进入']
  }
}

// Mock 导航步骤
const MOCK_NAV_STEPS = {
  steps: [
    '导航至IFS商场3号门',
    '进入后找到3号电梯',
    '乘电梯至3楼',
    '出电梯右转',
    '海底捞门口旁通道进入'
  ]
}

// ===== 请求封装 =====
function request(options) {
  return new Promise((resolve, reject) => {
    const header = {
      'Content-Type': 'application/json'
    }
    // Token 为空时不发送 Authorization header，避免发送空 Bearer token
    const token = getApp().globalData.token
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          reject(res.data)
        }
      },
      fail: reject
    })
  })
}

// ===== Mock API 实现 =====

/**
 * 1. GET /toilets/nearby — 附近厕所搜索
 * 响应为扁平结构（与后端一致）
 * 距离和步行时间根据用户真实坐标动态计算
 */
function getNearbyToilets(params = {}) {
  const { lat = 0, lng = 0, radius = 2000 } = params
  return new Promise((resolve) => {
    setTimeout(() => {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)
      // 动态计算每个厕所的距离，按距离排序后全部返回
      // Mock阶段不做半径过滤，所有厕所数据都展示在地图上
      const items = MOCK_TOILET_DETAILS
        .map(d => detailToNearbyItem(d, userLat, userLng))
        .sort((a, b) => a.distance_m - b.distance_m)
      resolve({
        total: items.length,
        page: 1,
        page_size: 20,
        items
      })
    }, 300)
  })
}

/**
 * 2. GET /toilets/{id} — 厕所详情
 * 响应为嵌套结构（与后端一致）
 */
function getToiletDetail(toiletId) {
  return new Promise((resolve, reject) => {
    if (!toiletId) {
      reject({ code: 1001, message: '参数错误：toiletId 不能为空' })
      return
    }
    setTimeout(() => {
      const toilet = MOCK_TOILET_DETAILS.find(t => t.id === toiletId)
      if (toilet) {
        resolve(toilet)
      } else {
        reject({ code: 1004, message: '厕所不存在' })
      }
    }, 300)
  })
}

/**
 * 3. GET /toilets/by-district — 按区域查询厕所
 */
function getToiletsByDistrict(params = {}) {
  const { district, page = 1, page_size = 20 } = params
  return new Promise((resolve) => {
    setTimeout(() => {
      // 按区域过滤（Mock阶段：根据name或landmark匹配区域关键词）
      let filtered = MOCK_TOILET_DETAILS
      if (district) {
        filtered = filtered.filter(d =>
          (d.name && d.name.indexOf(district) !== -1) ||
          (d.landmark && d.landmark.indexOf(district) !== -1)
        )
      }
      // 使用默认坐标计算距离（按区域搜索时不依赖用户位置）
      const defaultLat = 0, defaultLng = 0
      const items = filtered.map(d => detailToNearbyItem(d, defaultLat, defaultLng))
      resolve({
        total: items.length,
        page,
        page_size,
        items
      })
    }, 300)
  })
}

/**
 * 4. POST /recommend — 智能推荐厕所
 * 响应只包含后端定义的字段（rank, toilet_id, name, type, status_color, distance_m, walk_time_min, score, score_breakdown, highlights, direction）
 * 分数和排序均动态计算，不再写死
 */
function recommendToilet(params = {}) {
  const { scene = 'smart', lat = 0, lng = 0, radius = 2000, top_k = 5 } = params
  return new Promise((resolve) => {
    setTimeout(() => {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)

      let candidates = MOCK_TOILET_DETAILS.map(d => {
        const distance_m = mapUtil.getDistance(userLat, userLng, d.lat, d.lng)
        const walk_time_min = Math.max(1, Math.round(distance_m / 80))
        return { detail: d, distance_m, walk_time_min }
      })
      // Mock阶段不做半径过滤，全部纳入候选，按多维度打分排序即可

      // 硬筛选（对齐后端 recommend_engine.py 的 _apply_hard_filters）
      if (scene === 'diarrhea') {
        candidates = candidates.filter(c => c.detail.facilities.paper)
      } else if (scene === 'kids') {
        candidates = candidates.filter(c => c.detail.facilities.baby_station)
      }
      // 所有模式: 排除红色状态（已确认不可用）
      candidates = candidates.filter(c => c.detail.status.color !== 'red')

      // 降级推荐：全部候选被过滤后，重新纳入最近的 yellow 厕所
      let isDegraded = false
      if (candidates.length === 0) {
        candidates = MOCK_TOILET_DETAILS.map(d => {
          const distance_m = mapUtil.getDistance(userLat, userLng, d.lat, d.lng)
          const walk_time_min = Math.max(1, Math.round(distance_m / 80))
          return { detail: d, distance_m, walk_time_min }
        })
        if (scene === 'diarrhea') {
          candidates = candidates.filter(c => c.detail.facilities.paper)
        } else if (scene === 'kids') {
          candidates = candidates.filter(c => c.detail.facilities.baby_station)
        }
        candidates = candidates
          .filter(c => c.detail.status.color === 'yellow' || c.detail.status.color === 'green')
          .sort((a, b) => a.distance_m - b.distance_m)
        isDegraded = candidates.length > 0
      }

      // 按综合推荐分数排序
      candidates.sort((a, b) => {
        const scoreA = computeRecommendScore(a, scene)
        const scoreB = computeRecommendScore(b, scene)
        return scoreB - scoreA
      })

      const recommendations = candidates.slice(0, top_k).map((c, i) =>
        detailToRecommendation(c.detail, c.distance_m, c.walk_time_min, i + 1, scene)
      )

      resolve({
        scene,
        context: {
          is_night: false,
          is_meal_time: false,
          in_safe_zone: true
        },
        total_candidates: MOCK_TOILET_DETAILS.length,
        filtered_count: recommendations.length,
        recommendations,
        degraded: isDegraded,
        degraded_note: isDegraded ? '附近厕所可能不可用，建议谨慎' : ''
      })
    }, 800)
  })
}

/**
 * 计算推荐分数 (模拟后端 recommend_engine.py)
 * 返回 0~1 之间的分数
 */
function computeRecommendScore(candidate, scene) {
  const { detail, distance_m } = candidate
  const maxDist = 2000
  const distanceScore = Math.max(0, 1 - distance_m / maxDist)
  const statusScoreMap = { green: 1.0, yellow: 0.6, red: 0.0 }
  const statusScore = statusScoreMap[detail.status.color] || 0.5
  const qualityScore = (
    (detail.facilities.paper ? 0.3 : 0) +
    (detail.facilities.soap ? 0.2 : 0) +
    (detail.facilities.baby_station ? 0.2 : 0) +
    (detail.facilities.accessible ? 0.1 : 0)
  )
  let sceneScore = 0.5
  if (scene === 'diarrhea' && detail.facilities.paper) sceneScore = 1.0
  if (scene === 'kids' && detail.facilities.baby_station) sceneScore = 1.0

  return Math.min(0.99, Math.max(0.3,
    distanceScore * 0.4 +
    statusScore * 0.3 +
    qualityScore * 0.2 +
    sceneScore * 0.1
  ))
}

/**
 * 5. POST /recommend/switch-scene — 推荐场景切换
 */
function switchRecommendScene(params = {}) {
  const { lat = 0, lng = 0, from_scene = 'smart', to_scene = 'diarrhea' } = params
  return recommendToilet({ scene: to_scene, lat, lng })
}

/**
 * 6. POST /feedbacks — 提交反馈
 */
function submitFeedback(data) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        feedback_id: 'fb_' + Date.now(),
        trust_score_earned: 2,
        new_user_trust: 72
      })
    }, 500)
  })
}

/**
 * 7. GET /feedbacks/toilet/{toilet_id} — 获取厕所反馈列表
 */
function getToiletFeedbacks(toiletId, params = {}) {
  const { page = 1, page_size = 20 } = params || {}
  return new Promise((resolve) => {
    setTimeout(() => {
      const detail = MOCK_TOILET_DETAILS.find(t => t.id === toiletId)
      const stats = detail ? detail.stats : { feedback_count: 0, cleanliness_good_rate: 0, queue_empty_rate: 0 }
      resolve({
        total: stats.feedback_count || 0,
        stats: {
          available_rate: 0.88,
          cleanliness_good_rate: stats.cleanliness_good_rate || 0,
          queue_empty_rate: stats.queue_empty_rate || 0,
          paper_yes_rate: 0.78
        },
        items: [
          {
            id: 'fb_001',
            user_open_id: 'user_001',
            status: 'available',
            cleanliness: 'good',
            queue: 'empty',
            paper: 'yes',
            trust_score: 85,
            created_at: '2025-06-18T10:30:00+08:00'
          }
        ]
      })
    }, 300)
  })
}

/**
 * 8. GET /feedbacks/user/me — 获取用户反馈历史
 */
function getMyFeedbacks(params = {}) {
  const { page = 1, page_size = 20 } = params
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        total: 5,
        page,
        page_size,
        items: [
          {
            id: 'fb_001',
            toilet_id: 'toilet_001',
            status: 'available',
            cleanliness: 'good',
            queue: 'empty',
            paper: 'yes',
            created_at: '2025-06-18T10:30:00+08:00'
          }
        ]
      })
    }, 300)
  })
}

/**
 * 9. POST /auth/login — 微信登录
 */
function login(code) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        token: 'jwt_mock_token_' + Date.now(),
        user: {
          open_id: 'user_mock_001',
          trust_score: 60,
          role: 'L1',
          feedback_count: 0,
          contribute_count: 0,
          is_new: true
        }
      })
    }, 500)
  })
}

/**
 * 10. GET /users/me — 获取用户信息
 */
function getUserInfo() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        open_id: 'user_mock_001',
        trust_score: 72,
        role: 'L2',
        feedback_count: 25,
        accepted_count: 20,
        contribute_count: 3,
        created_at: '2025-01-15T08:00:00+08:00',
        last_active_at: '2025-06-18T10:30:00+08:00',
        badges: ['诚信反馈者', '厕所猎人']
      })
    }, 300)
  })
}

/**
 * 11. GET /users/me/stats — 获取用户贡献统计
 */
function getUserStats() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        total_feedbacks: 25,
        feedback_accept_rate: 0.80,
        total_contributions: 3,
        corrections_submitted: 5,
        corrections_approved: 3,
        trust_score_history: [
          { date: '2025-01', score: 60 },
          { date: '2025-02', score: 65 },
          { date: '2025-03', score: 72 }
        ]
      })
    }, 300)
  })
}

/**
 * 12. POST /corrections — 提交纠错
 */
function submitCorrection(data) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        correction_id: 'corr_' + Date.now(),
        status: 'pending'
      })
    }, 500)
  })
}

/**
 * 13. GET /corrections/user/me — 获取我的纠错记录
 */
function getMyCorrections(params = {}) {
  const { status, page = 1 } = params
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        total: 2,
        page,
        page_size: 20,
        items: [
          {
            id: 'corr_001',
            toilet_id: 'toilet_001',
            field: 'has_paper',
            old_value: 'true',
            new_value: 'false',
            status: 'approved',
            created_at: '2025-06-15T14:00:00+08:00'
          }
        ]
      })
    }, 300)
  })
}

/**
 * 14. GET /status/{toilet_id} — 获取厕所实时状态
 * 包含 annotation 和 recent_feedbacks（与后端一致）
 */
function getToiletStatus(toiletId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const detail = MOCK_TOILET_DETAILS.find(t => t.id === toiletId)
      resolve({
        toilet_id: toiletId,
        color: detail ? detail.status.color : 'green',
        confidence: detail ? detail.status.confidence : 95,
        reason: '5min内有可用反馈',
        annotation: '',
        updated_at: detail ? detail.status.updated_at : new Date().toISOString(),
        recent_feedbacks: {
          last_1h_available: 3,
          last_1h_unavailable: 0,
          last_feedback_at: '2025-06-18T10:28:00+08:00'
        }
      })
    }, 200)
  })
}

/**
 * 15. POST /status/batch — 批量获取状态
 */
function batchGetStatus(toiletIds) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const statuses = {}
      toiletIds.forEach(id => {
        const detail = MOCK_TOILET_DETAILS.find(t => t.id === id)
        statuses[id] = {
          color: detail ? detail.status.color : 'green',
          confidence: detail ? detail.status.confidence : 95
        }
      })
      resolve({ statuses })
    }, 200)
  })
}

// ===== 后端未定义但前端需要的接口（已在 api_spec.md 中补充） =====

/**
 * POST /nav/steps — 获取导航步骤
 */
function getNavSteps(toiletId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const detail = MOCK_TOILET_DETAILS.find(t => t.id === toiletId)
      resolve({
        toilet_id: toiletId,
        steps: MOCK_NAV_STEPS.steps
      })
    }, 200)
  })
}

/**
 * POST /toilet/contribute — 贡献厕所
 */
function submitContribute(data) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        toilet_id: 'toilet_new_' + Date.now(),
        status: 'pending',
        message: '已提交审核'
      })
    }, 500)
  })
}

/**
 * POST /feedback/confirm — 确认厕所状态（分享落地页快速确认）
 */
function confirmToiletStatus(toiletId, isAvailable) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        confirmed: true,
        toilet_id: toiletId,
        status: isAvailable ? 'available' : 'unavailable',
        trust_score_earned: 1
      })
    }, 300)
  })
}

module.exports = {
  request,
  // 厕所查询
  getNearbyToilets,
  getToiletDetail,
  getToiletsByDistrict,
  // 智能推荐
  recommendToilet,
  switchRecommendScene,
  // 反馈
  submitFeedback,
  getToiletFeedbacks,
  getMyFeedbacks,
  // 用户
  login,
  getUserInfo,
  getUserStats,
  // 纠错
  submitCorrection,
  getMyCorrections,
  // 状态
  getToiletStatus,
  batchGetStatus,
  // 前端自创（已补充后端定义）
  getNavSteps,
  submitContribute,
  confirmToiletStatus
}
