/**
 * 全局常量定义
 * 统一维护，避免在多处重复定义
 */

// 准入类型标签映射
const ACCESS_LABELS = {
  '自由进入': '🆓 免费进入',
  '需安检': '🔒 需安检',
  '建议消费': '☕ 建议消费',
  '必须消费': '💰 必须消费',
  '需门禁': '🔑 需门禁',
  '需密码': '🔐 需密码',
  '需登记': '📝 需登记'
}

// 厕所类型列表
const TOILET_TYPES = ['公厕', '商场厕所', '地铁厕所', '餐饮厕所', '公园厕所', '加油站厕所', '酒店厕所', '医院厕所']

// 准入类型列表
const ACCESS_TYPES = ['自由进入', '需安检', '建议消费', '必须消费', '需门禁', '需密码', '需登记']

// 运营类型列表
const OPERATING_TYPES = ['24小时', '跟随商场', '固定时间']

// 夜间判断（小时范围）
const NIGHT_START_HOUR = 21
const NIGHT_END_HOUR = 7

// 饭点判断（小时范围）
const MEAL_HOURS = [
  { start: 11, end: 13 },
  { start: 17, end: 19 }
]

// 场景标签
const SCENE_LABELS = {
  diarrhea: '🏃 腹泻优选',
  kids: '👶 带娃优选',
  smart: ''
}

module.exports = {
  ACCESS_LABELS,
  TOILET_TYPES,
  ACCESS_TYPES,
  OPERATING_TYPES,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
  MEAL_HOURS,
  SCENE_LABELS
}
