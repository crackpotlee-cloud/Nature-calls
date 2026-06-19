// pages/nav/nav.js - 导航引导页逻辑
const mapUtil = require('../../utils/map')
const statusUtil = require('../../utils/status')
const api = require('../../utils/api')
const feedbackPage = require('../feedback/feedback')

Page({
  data: {
    mapKey: '',
    latitude: 0,
    longitude: 0,
    markers: [],
    polyline: [],
    scale: 17,

    toiletName: '',
    toiletId: '',
    steps: [],
    walkTimeText: '',
    walkTimeSeconds: 0,
    statusLabel: '',
    toilet: null
  },

  // 是否已发起过外部导航
  _navStarted: false,

  onLoad(options) {
    const app = getApp()
    const toilet = app.globalData.currentToilet
    const userLoc = app.globalData.currentLocation || { lat: 30.658, lng: 104.082 }

    if (!toilet) {
      wx.showToast({ title: '未找到厕所信息', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const statusInfo = statusUtil.getStatusInfo(toilet.status_color || toilet.status?.color || 'green')
    const walkMin = toilet.walk_time_min || 0

    this.setData({
      mapKey: app.globalData.mapKey || mapUtil.MAP_KEY,
      toiletName: toilet.name || '目的地',
      toiletId: toilet.toilet_id || toilet.id,
      walkTimeText: walkMin > 0 ? walkMin + '分钟' : '计算中...',
      walkTimeSeconds: walkMin * 60,
      statusLabel: statusInfo.label,
      // 地图中心设为用户位置，马桶标记会在 renderMap 里添加
      latitude: userLoc.lat,
      longitude: userLoc.lng,
      toilet: toilet
    })

    this.renderMap(toilet)
    this.loadNavSteps()
  },

  // 用户从外部导航返回时触发
  onShow() {
    if (this._navStarted) {
      this._navStarted = false
      // 导航返回后自动弹出反馈
      this.showFeedbackAfterNav()
    }
  },

  // 渲染步行路线地图
  async renderMap(toilet) {
    const app = getApp()
    const userLoc = app.globalData.currentLocation

    const markerLat = toilet.entry_lat || toilet.lat
    const markerLng = toilet.entry_lng || toilet.lng

    const markers = [
      {
        id: 0,
        latitude: markerLat,
        longitude: markerLng,
        width: 36,
        height: 36,
        iconPath: mapUtil.getMarkerIcon(toilet.status_color || 'green'),
        callout: {
          content: toilet.name || '目的地',
          color: '#333',
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          display: 'ALWAYS'
        }
      }
    ]

    // 调用腾讯地图真实步行路线
    const routeResult = await mapUtil.getWalkingRoute(
      { lat: userLoc.lat, lng: userLoc.lng },
      { lat: markerLat, lng: markerLng }
    )

    // 更新真实步行时间
    let walkText = this.data.walkTimeText
    if (routeResult.duration && routeResult.duration > 0) {
      const realMin = Math.max(1, Math.round(routeResult.duration / 60))
      walkText = realMin + '分钟'
    }

    this.setData({
      markers,
      polyline: routeResult.polylines || [],
      walkTimeText: walkText,
      walkTimeSeconds: routeResult.duration || 0
    })
  },

  // 加载导航步骤
  async loadNavSteps() {
    try {
      const data = await api.getNavSteps(this.data.toiletId)
      this.setData({ steps: data.steps || [] })
    } catch (err) {
      this.setData({
        steps: [
          '导航至目的地建筑入口',
          '进入建筑后寻找电梯或扶梯',
          '到达指定楼层',
          '根据锚点品牌寻找厕所入口'
        ]
      })
    }
  },

  // 开始导航 - 调用微信地图拉起外部导航
  onStartNav() {
    const toilet = this.data.toilet
    if (!toilet) return

    // 标记已发起导航
    this._navStarted = true

    mapUtil.openNavigation(toilet)
  },

  // 导航返回后弹出反馈
  showFeedbackAfterNav() {
    const toilet = this.data.toilet
    const toiletId = toilet ? (toilet.toilet_id || toilet.id) : ''

    // 反馈降频检查
    if (!feedbackPage.shouldShowFeedback()) {
      wx.showToast({ title: '感谢使用三急', icon: 'success', duration: 1500 })
      setTimeout(() => wx.navigateBack({ delta: 2 }), 1500)
      return
    }

    wx.navigateTo({
      url: '/pages/feedback/feedback?id=' + toiletId + '&from=nav'
    })
  },

  // 我到了
  onArrive() {
    this.showFeedbackAfterNav()
  },

  // 直接反馈
  onDirectFeedback() {
    const toilet = this.data.toilet
    const toiletId = toilet ? (toilet.toilet_id || toilet.id) : ''
    wx.navigateTo({
      url: '/pages/feedback/feedback?id=' + toiletId + '&from=direct'
    })
  }
})
