// pages/share/share.js - 分享落地页逻辑
const api = require('../../utils/api')
const statusUtil = require('../../utils/status')
const mapUtil = require('../../utils/map')
const constants = require('../../utils/constants')

Page({
  data: {
    toilet: null,
    toiletName: '',
    statusLabel: '',
    statusShape: '',
    paperLabel: '',
    accessLabel: '',
    qualitySummary: ''
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
      const qualityParts = []
      if (facilities.paper) qualityParts.push('有纸👍')
      const s = toilet.stats || {}
      if ((s.cleanliness_good_rate || 0) > 0.6) qualityParts.push('干净👍')
      if ((s.queue_empty_rate || 0) > 0.5) qualityParts.push('排队少👍')

      this.setData({
        toilet,
        toiletName: toilet.name,
        statusLabel: statusInfo.label,
        statusShape: statusInfo.shape,
        paperLabel: facilities.paper ? '有纸' : '无纸',
        accessLabel: constants.ACCESS_LABELS[toilet.access_type] || toilet.access_type,
        qualitySummary: qualityParts.join(' ') || '暂无数据'
      })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 开始导航
  onStartNav() {
    if (this.data.toilet) {
      mapUtil.openNavigation(this.data.toilet)
    }
  },

  // 确认状态
  async onConfirmStatus(e) {
    const isAvailableRaw = e.currentTarget.dataset.status
    // 参数校验：仅接受 true/false
    if (isAvailableRaw !== true && isAvailableRaw !== false) {
      wx.showToast({ title: '无效的状态值', icon: 'none' })
      return
    }
    const isAvailable = Boolean(isAvailableRaw)
    if (!this.data.toilet) return

    try {
      await api.confirmToiletStatus(this.data.toilet.id, isAvailable)
      wx.showToast({
        title: isAvailable ? '✅ 感谢确认！' : '❌ 感谢反馈！',
        icon: 'none'
      })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  }
})
