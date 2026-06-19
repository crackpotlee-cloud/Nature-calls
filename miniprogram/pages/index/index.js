// pages/index/index.js - 首页逻辑
const api = require('../../utils/api')
const mapUtil = require('../../utils/map')
const statusUtil = require('../../utils/status')
const constants = require('../../utils/constants')

Page({
  data: {
    mapKey: '5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC',
    latitude: 30.658,
    longitude: 104.082,
    mapScale: 16,
    locationName: '定位中...',
    markers: [],
    calloutMarkerId: 0,
    calloutName: '',

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

    markerCardVisible: false,
    scenePanelVisible: false,
    loadingVisible: false
  },

  onLoad() {
    this.initAndLoad()
  },

  onShow() {
    this.initAndLoad()
  },

  // 获取定位 → 加载厕所
  initAndLoad() {
    const app = getApp()
    // 主动获取最新定位，不再依赖 app.js 的旧值
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        app.globalData.currentLocation = {
          lat: res.latitude,
          lng: res.longitude,
          name: '当前位置'
        }
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          locationName: '当前位置'
        })
        this.loadNearbyToilets()
      },
      fail: () => {
        // 降级使用已有的 globalData 值
        const loc = app.globalData.currentLocation
        this.setData({
          latitude: loc.lat,
          longitude: loc.lng,
          locationName: loc.name || '定位失败'
        })
        this.loadNearbyToilets()
      }
    })
  },

  // 加载附近厕所
  async loadNearbyToilets() {
    try {
      const data = await api.getNearbyToilets({
        lat: this.data.latitude,
        lng: this.data.longitude,
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

  onMapTap() {
    if (this.data.markerCardVisible) {
      this.setData({ markerCardVisible: false })
    }
  },

  onMarkerCardTap() {
    if (this.data.selectedToilet.id) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${this.data.selectedToilet.id}`
      })
    }
  },

  onGoToNav() {
    const toilet = this.data.selectedToilet
    if (!toilet.id) return

    const app = getApp()
    const marker = this.data.markers.find(m => m.id === toilet.id)
    app.globalData.currentToilet = marker && marker._data ? marker._data : toilet

    wx.navigateTo({
      url: '/pages/nav/nav'
    })
  },

  onEmergencyTap() {
    this.quickSearch('smart')
  },

  onEmergencyLongPress() {
    this.setData({ scenePanelVisible: true })
  },

  async quickSearch(scene) {
    this.setData({ loadingVisible: true })
    try {
      const app = getApp()
      const loc = app.globalData.currentLocation

      let data = await api.recommendToilet({
        scene,
        lat: loc.lat,
        lng: loc.lng,
        radius: 500,
        top_k: 5
      })

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

      if (!data.recommendations || data.recommendations.length === 0) {
        this.setData({ loadingVisible: false })
        wx.showToast({ title: '当前区域暂无厕所数据', icon: 'none', duration: 3000 })
        return
      }

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

  onSelectScene(e) {
    const scene = e.currentTarget.dataset.scene
    this.setData({ scenePanelVisible: false })
    this.quickSearch(scene)
  },

  hideScenePanel() {
    this.setData({ scenePanelVisible: false })
  },

  onLocate() {
    const mapCtx = wx.createMapContext('homeMap')
    mapCtx.moveToLocation()
    wx.showToast({ title: '已定位到当前位置', icon: 'none', duration: 1500 })
  },

  onAddToilet() {
    wx.navigateTo({
      url: '/pages/contribute/contribute'
    })
  },

  onShareAppMessage() {
    return {
      title: '三急 - 找到最近的厕所',
      path: '/pages/index/index'
    }
  }
})
