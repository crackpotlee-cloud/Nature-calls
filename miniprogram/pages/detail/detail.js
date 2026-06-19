// pages/detail/detail.js - 厕所详情页逻辑
const api = require('../../utils/api')
const statusUtil = require('../../utils/status')
const mapUtil = require('../../utils/map')
const constants = require('../../utils/constants')

Page({
  data: {
    toilet: null,
    statusLabel: '',
    statusShape: '',
    walkTimeText: '',
    accessLabel: '',
    operationText: '',
    updateTime: '',
    operationNote: '',
    facilityList: [],
    stats: {
      cleanlinessGoodPercent: 70,
      cleanlinessOkPercent: 20,
      cleanlinessBadPercent: 10,
      queueEmptyPercent: 90,
      queueFewPercent: 10,
      queueLongPercent: 0,
      paperYesPercent: 80,
      paperLowPercent: 20,
      paperNoPercent: 0
    }
  },

  onLoad(options) {
    const toiletId = options.id
    if (toiletId) {
      this.loadToiletDetail(toiletId)
    }
  },

  async loadToiletDetail(toiletId) {
    try {
      const toilet = await api.getToiletDetail(toiletId)
      const statusInfo = statusUtil.getStatusInfo((toilet.status && toilet.status.color) || 'green')

      const facilities = toilet.facilities || {}
      const facilityList = statusUtil.getFacilityList(facilities)

      const now = new Date()
      const updateTime = `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

      // 构建统计（详情接口 stats 只有 cleanliness_good_rate / queue_empty_rate）
      // paper 相关从 facilities.paper 推导
      const s = toilet.stats || {}
      const paperYesRate = toilet.facilities && toilet.facilities.paper ? 0.78 : 0.10
      const stats = {
        cleanlinessGoodPercent: Math.round((s.cleanliness_good_rate || 0.7) * 100),
        cleanlinessOkPercent: Math.round((1 - (s.cleanliness_good_rate || 0.7)) * 0.67 * 100),
        cleanlinessBadPercent: Math.round((1 - (s.cleanliness_good_rate || 0.7)) * 0.33 * 100),
        queueEmptyPercent: Math.round((s.queue_empty_rate || 0.6) * 100),
        queueFewPercent: Math.round((1 - (s.queue_empty_rate || 0.6)) * 0.8 * 100),
        queueLongPercent: Math.round((1 - (s.queue_empty_rate || 0.6)) * 0.2 * 100),
        paperYesPercent: Math.round(paperYesRate * 100),
        paperLowPercent: Math.round((1 - paperYesRate) * 0.8 * 100),
        paperNoPercent: Math.round((1 - paperYesRate) * 0.2 * 100)
      }

      // 运营状态标注
      const opNote = this.getOperationNote(toilet)

      this.setData({
        toilet,
        statusLabel: statusInfo.label,
        statusShape: statusInfo.shape,
        walkTimeText: statusUtil.formatWalkTime(toilet.walk_time_min || 0),
        accessLabel: constants.ACCESS_LABELS[toilet.access_type] || toilet.access_type,
        operationText: toilet.operation
          ? `${toilet.operation.type || '固定时间'} (${toilet.operation.open_time || '--'}-${toilet.operation.close_time || '--'})`
          : '24小时',
        operationNote: opNote,
        updateTime,
        facilityList,
        stats
      })
    } catch (err) {
      wx.showToast({ title: '加载详情失败', icon: 'none' })
    }
  },

  // 获取运营状态标注
  getOperationNote(toilet) {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const currentMinutes = hour * 60 + minute
    const opType = (toilet.operation && toilet.operation.type) || ''

    // 商场闭店标注
    if (opType === '跟随商场') {
      if (currentMinutes >= 22 * 60 || currentMinutes < 10 * 60) {
        return '🏬 商场已闭店'
      }
    }

    // 地铁末班车标注
    if (toilet.type === '地铁厕所') {
      if (currentMinutes >= 23 * 60 + 30 || currentMinutes < 6 * 60) {
        return '🚇 地铁运营结束'
      }
    }

    // 一般运营时间外
    if (opType === '固定时间') {
      const openTime = (toilet.operation && toilet.operation.open_time) || ''
      const closeTime = (toilet.operation && toilet.operation.close_time) || ''
      if (openTime && closeTime) {
        const openParts = openTime.split(':')
        const closeParts = closeTime.split(':')
        const openMin = parseInt(openParts[0]) * 60 + parseInt(openParts[1] || 0)
        const closeMin = parseInt(closeParts[0]) * 60 + parseInt(closeParts[1] || 0)
        const inRange = closeMin > openMin
          ? (currentMinutes >= openMin && currentMinutes <= closeMin)
          : (currentMinutes >= openMin || currentMinutes <= closeMin)
        if (!inRange) return '⏰ 运营时间外'
      }
    }

    return ''
  },

  // 开始导航
  onStartNav() {
    const app = getApp()
    app.globalData.currentToilet = this.data.toilet
    wx.navigateTo({
      url: '/pages/nav/nav'
    })
  },

  // 分享
  onShare() {
    // 小程序内分享
  },

  // 小程序分享
  onShareAppMessage() {
    const toilet = this.data.toilet
    return {
      title: `三急：${toilet ? toilet.name : '厕所详情'}`,
      path: `/pages/share/share?id=${toilet ? toilet.id : ''}`
    }
  },

  onBack() {
    wx.navigateBack()
  }
})
