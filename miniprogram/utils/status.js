/**
 * 状态计算客户端辅助
 */

const STATUS_CONFIG = {
  green: {
    color: '#34A853',
    label: '可用',
    shape: '●',
    description: '近期有人确认可用'
  },
  yellow: {
    color: '#FBBC04',
    label: '待确认',
    shape: '▲',
    description: '信息不确定，请谨慎'
  },
  red: {
    color: '#EA4335',
    label: '不可用',
    shape: '■',
    description: '已确认不可用'
  }
}

/**
 * 获取状态展示信息
 */
function getStatusInfo(statusColor) {
  return STATUS_CONFIG[statusColor] || STATUS_CONFIG.green
}

/**
 * 获取状态颜色CSS类
 */
function getStatusColorClass(statusColor) {
  return STATUS_CONFIG[statusColor] ? statusColor : 'green'
}

/**
 * 获取置信度标签
 */
function getConfidenceLabel(confidence) {
  if (confidence >= 90) return '高置信'
  if (confidence >= 60) return '中置信'
  return '低置信'
}

/**
 * 计算推荐得分颜色
 */
function getScoreColor(score) {
  if (score >= 0.9) return '#34A853'
  if (score >= 0.7) return '#FBBC04'
  return '#EA4335'
}

/**
 * 格式化步行时间
 */
function formatWalkTime(minutes) {
  if (minutes < 1) return '不到1分钟'
  if (minutes < 60) return `步行${Math.round(minutes)}分钟`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `步行${h}小时${m}分钟` : `步行${h}小时`
}

/**
 * 格式化距离
 */
function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/**
 * 获取设施列表展示
 */
function getFacilityList(facilities) {
  const list = []
  if (facilities.seat) list.push({ name: '坐便', icon: '🚽' })
  if (facilities.squat) list.push({ name: '蹲坑', icon: '🚾' })
  if (facilities.accessible) list.push({ name: '无障碍', icon: '♿' })
  if (facilities.baby_station) list.push({ name: '母婴台', icon: '👶' })
  if (facilities.paper) list.push({ name: '有纸', icon: '🧻' })
  if (facilities.soap) list.push({ name: '洗手液', icon: '🧴' })
  if (facilities.hand_dryer) list.push({ name: '烘手机', icon: '💨' })
  return list
}

/**
 * 检查厕所当前是否在运营时间
 */
function isOperating(operation) {
  if (!operation || operation.type === '24小时') return true

  // 安全取值：兼容 operation 和 operating_hours 两种字段名
  const op = (operation.operation || operation.operating_hours || operation)
  if (!op || !op.open_time || !op.close_time) return true

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  
  const openParts = op.open_time.split(':')
  const closeParts = op.close_time.split(':')
  if (!openParts[0] || !closeParts[0]) return true

  const openMinutes = parseInt(openParts[0]) * 60 + parseInt(openParts[1] || 0)
  const closeMinutes = parseInt(closeParts[0]) * 60 + parseInt(closeParts[1] || 0)
  
  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes
  } else {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes
  }
}

module.exports = {
  STATUS_CONFIG,
  getStatusInfo,
  getStatusColorClass,
  getConfidenceLabel,
  getScoreColor,
  formatWalkTime,
  formatDistance,
  getFacilityList,
  isOperating
}
