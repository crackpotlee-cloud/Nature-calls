App({
  globalData: {
    userInfo: null,
    token: null,
    mapKey: '5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC',
    // 初始不写死任何位置，等 getLocation 异步获取后再赋值
    // 用 null 标记「尚未定位」，页面渲染前需检查此值
    currentLocation: null,
    currentScene: 'smart',
    currentToilet: null,
    isNight: false,
    isMealTime: false,
    // 定位回调列表，页面可注册回调等待定位完成
    _locationCallbacks: []
  },

  onLaunch() {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync()
    this.globalData.systemInfo = systemInfo
    this.globalData.statusBarHeight = systemInfo.statusBarHeight
    this.globalData.screenWidth = systemInfo.screenWidth
    this.globalData.screenHeight = systemInfo.screenHeight

    // 加载共享常量
    const constants = require('./utils/constants')

    // 检查夜间模式（使用共享常量）
    const hour = new Date().getHours()
    this.globalData.isNight = hour < constants.NIGHT_END_HOUR || hour >= constants.NIGHT_START_HOUR
    this.globalData.isMealTime = constants.MEAL_HOURS.some(
      range => hour >= range.start && hour <= range.end
    )

    // 微信登录
    this.wxLogin()

    // 获取位置（异步，完成后通知所有等待中的页面）
    this.getLocation()
  },

  // 注册定位完成后的回调
  onLocationReady(callback) {
    if (this.globalData.currentLocation) {
      // 已经定位成功，直接执行回调
      callback(this.globalData.currentLocation)
    } else {
      this.globalData._locationCallbacks.push(callback)
    }
  },

  wxLogin() {
    const api = require('./utils/api')
    wx.login({
      success: (res) => {
        if (res.code) {
          api.login(res.code).then(data => {
            this.globalData.token = data.token
            this.globalData.userInfo = data.user
            console.log('登录成功, token:', data.token)
          }).catch(err => {
            console.error('登录失败:', err)
          })
        }
      }
    })
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.globalData.currentLocation = {
          lat: res.latitude,
          lng: res.longitude,
          name: '当前位置'
        }
        console.log('[app.js] 获取定位成功:', this.globalData.currentLocation)

        // 通知所有等待定位的页面
        const callbacks = this.globalData._locationCallbacks
        this.globalData._locationCallbacks = []
        callbacks.forEach(cb => cb(this.globalData.currentLocation))
      },
      fail: (err) => {
        console.warn('[app.js] 获取定位失败:', err)
        // 定位失败时，仍通知回调（页面自行处理）
        const callbacks = this.globalData._locationCallbacks
        this.globalData._locationCallbacks = []
        callbacks.forEach(cb => cb(null))
      }
    })
  }
})
