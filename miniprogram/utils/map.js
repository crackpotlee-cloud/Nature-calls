/**
 * 地图工具函数
 * 腾讯地图Key: 5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC
 */

const MAP_KEY = '5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC'

/**
 * 计算两点距离 (Haversine公式, 单位: 米)
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * 估算步行时间 (分钟)
 */
function estimateWalkTime(distanceMeters) {
  const speedMetersPerMin = 80
  return Math.max(1, Math.round(distanceMeters / speedMetersPerMin))
}

/**
 * 获取地图标记图标 (根据状态)
 */
function getMarkerIcon(statusColor) {
  const iconMap = {
    green: '/images/toilet-green.png',
    yellow: '/images/toilet-yellow.png',
    red: '/images/toilet-red.png'
  }
  return iconMap[statusColor] || iconMap.green
}

/**
 * 生成地图标记点数据 (用于map组件markers)
 */
function createToiletMarkers(toilets) {
  return toilets.map(t => ({
    id: t.id,
    latitude: t.lat,
    longitude: t.lng,
    width: 36,
    height: 36,
    iconPath: getMarkerIcon(t.status_color),
    callout: {
      content: t.name,
      color: '#333',
      fontSize: 12,
      borderRadius: 8,
      padding: 8,
      display: 'BYCLICK'
    },
    _data: t
  }))
}

/**
 * 获取步行路线 - 调用腾讯地图 direction API
 * 先尝试步行API，距离超长时降级为驾车API（驾车没有距离限制）
 * @param {Object} from - { lat, lng }
 * @param {Object} to - { lat, lng }
 * @returns {Promise<Object>} { polylines: Array, duration: Number(秒), distance: Number(米) }
 */
async function getWalkingRoute(from, to) {
  try {
    return await fetchRouteFromTencent(from, to, 'walking')
  } catch (walkErr) {
    console.warn('[map.js] 步行路线失败，尝试驾车路线:', walkErr.message)
    // 步行超距离限制，降级为驾车路线
    try {
      return await fetchRouteFromTencent(from, to, 'driving')
    } catch (driveErr) {
      console.error('[map.js] 驾车路线也失败:', driveErr.message)
      throw driveErr
    }
  }
}

/**
 * 调用腾讯位置服务 direction API (步行/驾车通用)
 * 官方前向差分解压算法
 */
function fetchRouteFromTencent(from, to, mode) {
  var apiUrl = mode === 'walking'
    ? 'https://apis.map.qq.com/ws/direction/v1/walking'
    : 'https://apis.map.qq.com/ws/direction/v1/driving'

  return new Promise((resolve, reject) => {
    wx.request({
      url: apiUrl,
      data: {
        key: MAP_KEY,
        from: from.lat + ',' + from.lng,
        to: to.lat + ',' + to.lng
      },
      success(res) {
        console.log('[map.js] 腾讯' + mode + ' API status:', res.data && res.data.status)
        if (res.data && res.data.status === 0 && res.data.result) {
          const route = res.data.result.routes && res.data.result.routes[0]
          if (route && route.polyline) {
            // 官方前向差分解压算法
            var coors = route.polyline
            var kr = 1000000
            for (var i = 2; i < coors.length; i++) {
              coors[i] = Number(coors[i - 2]) + Number(coors[i]) / kr
            }
            var coords = []
            for (var i = 0; i < coors.length; i += 2) {
              coords.push({ latitude: coors[i], longitude: coors[i + 1] })
            }

            if (coords.length > 1) {
              console.log('[map.js] ' + mode + ' 解压成功, 共' + coords.length + '个点')
              resolve({
                polylines: [{
                  points: coords,
                  color: '#1A73E8',
                  width: 5,
                  dottedLine: false,
                  arrowLine: true,
                  borderColor: '#FFFFFF',
                  borderWidth: 1
                }],
                duration: route.duration || 0,
                distance: route.distance || 0
              })
              return
            }
          }
        }
        var errMsg = res.data ? res.data.message : 'unknown'
        console.error('[map.js] 腾讯' + mode + ' API错误:', res.data && res.data.status, errMsg)
        reject(new Error(errMsg))
      },
      fail(err) {
        console.error('[map.js] 腾讯' + mode + '请求失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 打开外部导航
 */
function openNavigation(toilet) {
  wx.openLocation({
    latitude: toilet.entry_lat || toilet.lat,
    longitude: toilet.entry_lng || toilet.lng,
    name: toilet.name,
    address: toilet.landmark || toilet.direction || '',
    scale: 18
  })
}

/**
 * 获取地图中心偏移 (适配底部卡片)
 */
function getMapCenterOffset(hasBottomCard) {
  return hasBottomCard ? { x: 0, y: -0.3 } : { x: 0, y: 0 }
}

module.exports = {
  getDistance,
  estimateWalkTime,
  getMarkerIcon,
  createToiletMarkers,
  getWalkingRoute,
  openNavigation,
  getMapCenterOffset,
  MAP_KEY
}
