// pages/index/index.js - 首页逻辑
const api = require('../../utils/api')
const mapUtil = require('../../utils/map')
const statusUtil = require('../../utils/status')
const constants = require('../../utils/constants')

Page({
  data: {
    mapKey: '5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC', // 腾讯地图Key
    latitude: 0,   // 初始化为0，等待获取真实位置后设置
    longitude: 0,
    mapScale: 16,
    locationName: '定位中...',
    markers: [],
    calloutMarkerId: 0,
    calloutName: '',

    // 选中的厕所
    selectedToilet: {
      id: '',
      name: '',
      status_color: 'green',
      walk_time_min: 0
    },
    statusLabel: '可用',
    statusConfidence: 80,
    statusUpdateTime: '',
    walkTimeText: '',
    walkDistanceText: '',
    accessLabel: '',
    qualityLabel: '',

    // UI状态
    markerCardVisible: false,
    scenePanelVisible: false,
    loadingVisible: false
  },

  onLoad() {
    this.initLocation()
  },

  onShow() {
    // 每次回到首页刷新位置并重新加载
    this.initLocation()
  },

  // 初始化位置
  initLocation() {
    const app = getApp()
    // 如果已有真实位置，直接使用
    if (app.globalData.currentLocation && app.globalData.currentLocation.lat !== 30.658) {
      this.useLocation(app.globalData.currentLocation)
    } else {
      // 重新获取位置
      app.getLocation()
      // 等待一小段时间获取位置（getLocation是异步的）
      setTimeout(() => {
        const loc = app.globalData.currentLocation
        this.useLocation(loc)
      }, 1500)
    }
  },

  // 使用位置加载厕所
  useLocation(loc) {
    if (!loc || !loc.lat) {
      // 如果仍然没有位置，使用成都作为最后的降级
      loc = { lat: 30.658, lng: 104.082, name: '成都 · 春熙路IFS附近（定位失败）' }
    }
    this.setData({
      latitude: loc.lat,
      longitude: loc.lng,
      locationName: loc.name || '当前位置'
    })
    this.loadNearbyToilets()
  },

  // 加载附近厕所
  async loadNearbyToilets() {
    try {
      const loc = {
        lat: this.data.latitude,
        lng: this.data.longitude
      }
      // 如果位置还没初始化(仍然是0)，不发起请求
      if (!loc.lat || !loc.lng) {
        return
      }

      const data = await api.getNearbyToilets({
        lat: loc.lat,
        lng: loc.lng,
        radius: 2000
      })

      const markers = mapUtil.createToiletMarkers(data.items)
      this.setData({ markers })
    } catch (err) {
      console.error('加载厕所失败:', err)
    }
  },

  // 地图标记点击 → Waze风格大卡片
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const marker = this.data.markers.find(m => m.id === markerId)
    if (!marker || !marker._data) return

    const toilet = marker._data
    const statusInfo = statusUtil.getStatusInfo(toilet.status_color)
    const confidence = toilet.status?.confidence || toilet.confidence || 80
    const updateMinutes = toilet.status?.last_update_minutes || toilet.last_update_minutes || 0
    const updateTimeText = updateMinutes > 0 ? `${updateMinutes}分钟前` : '刚刚'

    this.setData({
      selectedToilet: {
        id: toilet.id,
        name: toilet.name,
        status_color: toilet.status_color,
        walk_time_min: toilet.walk_time_min,
        walk_distance: toilet.walk_distance || 0,
        access_type: toilet.access_type || '自由进入',
        quality: toilet.quality || ''
      },
      statusLabel: statusInfo.label,
      statusConfidence: confidence,
      statusUpdateTime: updateTimeText,
      walkTimeText: statusUtil.formatWalkTime(toilet.walk_time_min),
      walkDistanceText: statusUtil.formatDistance(toilet.walk_distance || 0),
      accessLabel: constants.ACCESS_LABELS[toilet.access_type] || toilet.access_type,
      qualityLabel: toilet.quality || '',
      markerCardVisible: true
    })
  },

  // 地图空白区域点击
  onMapTap() {
    if (this.data.markerCardVisible) {
      this.setData({ markerCardVisible: false })
    }
  },

  // 标记卡片点击 → 跳转详情
  onMarkerCardTap() {
    if (this.data.selectedToilet.id) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${this.data.selectedToilet.id}`
      })
    }
  },

  // 卡片"去这里"按钮 → 跳转导航
  onGoToNav() {
    const toilet = this.data.selectedToilet
    if (!toilet.id) return

    const app = getApp()
    // 从 markers 中找到完整数据传给 nav
    const marker = this.data.markers.find(m => m.id === toilet.id)
    app.globalData.currentToilet = marker && marker._data ? marker._data : toilet

    wx.navigateTo({
      url: '/pages/nav/nav'
    })
  },

  // 急按钮点击 → 快速搜索
  onEmergencyTap() {
    this.quickSearch('smart')
  },

  // 长按急按钮 → 场景选择
  onEmergencyLongPress() {
    this.setData({ scenePanelVisible: true })
  },

  // 快速搜索（级联搜索：500m → 1000m）
  async quickSearch(scene) {
    this.setData({ loadingVisible: true })
    try {
      const app = getApp()
      const loc = app.globalData.currentLocation

      // 级联搜索：先尝试 500m
      let data = await api.recommendToilet({
        scene,
        lat: loc.lat,
        lng: loc.lng,
        radius: 500,
        top_k: 5
      })

      // 500m 无结果 → 自动扩大至 1000m
      if (!data.recommendations || data.recommendations.length === 0) {
        wx.showToast({ title: '附近厕所较少，已扩大搜索范围', icon: 'none', duration: 2000 })
        data = await api.recommendToilet({
          scene,
          lat: loc.lat,
          lng: loc.lng,
          radius: 1000,
          top_k: 5
        })
      }

      // 1000m 仍无结果 → 提示用户
      if (!data.recommendations || data.recommendations.length === 0) {
        this.setData({ loadingVisible: false })
        wx.showToast({ title: '当前区域暂无厕所数据', icon: 'none', duration: 3000 })
        return
      }

      // 存储推荐结果到全局
      app.globalData.currentScene = scene
      app.globalData.currentRecommendations = data.recommendations
      app.globalData.currentToilet = data.recommendations[0]

      this.setData({ loadingVisible: false })
      
      wx.navigateTo({
        url: '/pages/result/result'
      })
    } catch (err) {
      this.setData({ loadingVisible: false })
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
    }
  },

  // 场景选择
  onSelectScene(e) {
    const scene = e.currentTarget.dataset.scene
    this.setData({ scenePanelVisible: false })
    this.quickSearch(scene)
  },

  // 隐藏场景面板
  hideScenePanel() {
    this.setData({ scenePanelVisible: false })
  },

  // 定位按钮
  onLocate() {
    const mapCtx = wx.createMapContext('homeMap')
    mapCtx.moveToLocation()
    wx.showToast({ title: '已定位到当前位置', icon: 'none', duration: 1500 })
  },

  // 贡献厕所
  onAddToilet() {
    wx.navigateTo({
      url: '/pages/contribute/contribute'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '三急 - 找到最近的厕所',
      path: '/pages/index/index'
    }
  }
})
