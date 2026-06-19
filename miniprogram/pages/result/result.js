// pages/result/result.js - 推荐结果页逻辑
const mapUtil = require('../../utils/map')
const statusUtil = require('../../utils/status')
const constants = require('../../utils/constants')

Page({
  data: {
    mapKey: '5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC',
    latitude: 0,
    longitude: 0,
    markers: [],
    polyline: [],

    // 推荐结果
    sceneBadge: '',
    toiletName: '',
    walkTimeText: '',
    statusColor: 'green',
    statusShape: '●',
    statusText: '',
    accessTypeText: '',
    highlights: [],

    // 备选列表
    backupList: [],
    backupVisible: false,

    // 当前选中
    currentToilet: null,
    recommendations: [],

    // 卡片拖拽
    cardTranslateY: 0,
    touchStartY: 0,

    // 运营状态标注
    operationNote: ''
  },

  onLoad() {
    const app = getApp()
    const recommendations = app.globalData.currentRecommendations || []
    const currentToilet = app.globalData.currentToilet
    const scene = app.globalData.currentScene
    const userLoc = app.globalData.currentLocation || { lat: 0, lng: 0 }

    if (!currentToilet) {
      wx.showToast({ title: '请先搜索', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    // 场景标签
    const sceneLabels = constants.SCENE_LABELS

    this.setData({
      recommendations,
      currentToilet,
      sceneBadge: sceneLabels[scene] || '',
      latitude: userLoc.lat,
      longitude: userLoc.lng
    })

    this.renderToilet(currentToilet)
    this.renderMap(currentToilet)
  },

  // 渲染厕所信息
  renderToilet(toilet) {
    const statusInfo = statusUtil.getStatusInfo(toilet.status_color)

    // 运营状态标注
    const opText = this.getOperationNote(toilet)

    this.setData({
      toiletName: toilet.name,
      walkTimeText: statusUtil.formatWalkTime(toilet.walk_time_min),
      statusColor: statusInfo.color,
      statusShape: statusInfo.shape,
      statusText: `${statusInfo.label} · 推荐分${Math.round((toilet.score || 0) * 100)}%`,
      accessTypeText: constants.ACCESS_LABELS[toilet.access_type] || toilet.access_type,
      highlights: toilet.highlights || [],
      operationNote: opText
    })

    // 构建备选列表
    const backups = this.data.recommendations
      .filter(t => t.toilet_id !== toilet.toilet_id)
      .slice(0, 4)
      .map(t => ({
        ...t,
        walkTimeText: statusUtil.formatWalkTime(t.walk_time_min)
      }))

    this.setData({ backupList: backups })
  },

  // 渲染地图
  async renderMap(toilet) {
    const app = getApp()
    const userLoc = app.globalData.currentLocation

    this.setData({
      latitude: userLoc.lat,
      longitude: userLoc.lng
    })

    // 使用推荐接口返回的入口坐标。
    // 如果接口未返回 entry_lat/entry_lng（接口缺陷），降级使用厕所主体坐标，
    // 若均不可用则使用用户位置（标注为"坐标缺失"并提示用户）。
    let markerLat, markerLng
    if (toilet.entry_lat && toilet.entry_lng) {
      markerLat = toilet.entry_lat
      markerLng = toilet.entry_lng
    } else if (toilet.lat && toilet.lng) {
      markerLat = toilet.lat
      markerLng = toilet.lng
      wx.showToast({ title: '入口坐标缺失，使用主体坐标', icon: 'none', duration: 2000 })
    } else {
      // 坐标完全缺失：回退到用户位置并提示
      markerLat = userLoc.lat
      markerLng = userLoc.lng
      wx.showToast({ title: '坐标缺失，无法精确定位', icon: 'none', duration: 3000 })
    }

    // 用户位置 + 厕所标记
    const markers = [
      {
        id: 0,
        latitude: markerLat,
        longitude: markerLng,
        width: 36,
        height: 36,
        iconPath: mapUtil.getMarkerIcon(toilet.status_color),
        callout: {
          content: toilet.name,
          color: '#333',
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          display: 'ALWAYS'
        }
      }
    ]

    // 添加备选标记
    this.data.backupList.forEach((t, i) => {
      let blLat, blLng
      if (t.entry_lat && t.entry_lng) {
        blLat = t.entry_lat
        blLng = t.entry_lng
      } else if (t.lat && t.lng) {
        blLat = t.lat
        blLng = t.lng
      } else {
        // 坐标缺失：不在地图上显示此备选标记
        return
      }
      markers.push({
        id: i + 1,
        latitude: blLat,
        longitude: blLng,
        width: 28,
        height: 28,
        iconPath: mapUtil.getMarkerIcon(t.status_color)
      })
    })

    // 调用腾讯地图真实步行路线
    try {
      const routeResult = await mapUtil.getWalkingRoute(
        { lat: userLoc.lat, lng: userLoc.lng },
        { lat: markerLat, lng: markerLng }
      )

      // 更新真实步行时间
      let realWalkText = this.data.walkTimeText
      if (routeResult.duration && routeResult.duration > 0) {
        const realMin = Math.max(1, Math.round(routeResult.duration / 60))
        realWalkText = realMin + '分钟'
      }

      this.setData({ markers, polyline: routeResult.polylines || [], walkTimeText: realWalkText })
    } catch (err) {
      console.error('[result] 路线规划失败:', err)
      this.setData({ markers, polyline: [] })
      wx.showToast({ title: '路线规划失败: ' + (err.message || err), icon: 'none', duration: 3000 })
    }
  },

  // 切换备选厕所
  onSelectBackup(e) {
    const index = e.currentTarget.dataset.index
    const toilet = this.data.backupList[index]
    if (!toilet) return

    this.setData({
      backupVisible: false,
      currentToilet: toilet
    })
    this.renderToilet(toilet)
    this.renderMap(toilet)
  },

  // 切换备选列表
  toggleBackup() {
    this.setData({ backupVisible: !this.data.backupVisible })
  },

  // 卡片拖拽处理（保留兼容）
  onBackupTouchStart(e) {
    this.setData({ touchStartY: e.touches[0].clientY })
  },

  onBackupTouchMove(e) {
    const dy = e.touches[0].clientY - this.data.touchStartY
    if (dy < -50 && !this.data.backupVisible) {
      this.setData({ backupVisible: true })
    }
  },

  onBackupTouchEnd() {
    // 不做额外处理
  },

  // 开始导航
  onStartNav() {
    if (this.data.currentToilet) {
      wx.navigateTo({
        url: '/pages/nav/nav'
      })
    }
  },

  // 返回首页
  onBack() {
    wx.navigateBack()
  },

  // 获取运营状态标注
  getOperationNote(toilet) {
    // 检查运营类型
    const opType = toilet.operating_type || ''
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const currentMinutes = hour * 60 + minute

    // 商场闭店标注（跟随商场类型，22:00-10:00）
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
      if (!statusUtil.isOperating({ type: opType, open_time: toilet.open_time, close_time: toilet.close_time })) {
        return '⏰ 运营时间外'
      }
    }

    return ''
  },

  // 分享
  onShareAppMessage() {
    const toilet = this.data.currentToilet
    return {
      title: `三急推荐：${toilet ? toilet.name : '附近厕所'}`,
      path: toilet ? `/pages/share/share?id=${toilet.toilet_id}` : '/pages/index/index'
    }
  }
})
