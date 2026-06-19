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
 * 获取步行路线 - 调用腾讯地图 walking direction API
 * 返回真实步行路径点串 + 真实步行时间
 * @param {Object} from - { lat, lng }
 * @param {Object} to - { lat, lng }
 * @returns {Promise<Object>} { polylines: Array, duration: Number(秒), distance: Number(米) }
 */
async function getWalkingRoute(from, to) {
  try {
    const result = await fetchWalkingRouteFromTencent(from, to)
    if (result && result.polylines && result.polylines.length > 0) {
      return result
    }
  } catch (err) {
    console.log('腾讯步行路线获取失败，使用直线:', err.message || err)
  }

  // 降级：直线
  const distance = getDistance(from.lat, from.lng, to.lat, to.lng)
  const duration = Math.max(60, Math.round(distance / 80) * 60)
  return {
    polylines: [{
      points: [
        { latitude: from.lat, longitude: from.lng },
        { latitude: to.lat, longitude: to.lng }
      ],
      color: '#1A73E8',
      width: 5,
      dottedLine: false,
      arrowLine: true,
      borderColor: '#FFFFFF',
      borderWidth: 1
    }],
    duration: duration,
    distance: distance
  }
}

/**
 * 调用腾讯位置服务 walking direction API
 * 官方文档: https://lbs.qq.com/service/webService/webServiceGuide/webServiceRoute
 *
 * polyline压缩格式解压（官方算法，前向差分）:
 * polyline[0], polyline[1] 是起点 lat,lng（已是真实浮点坐标）
 * polyline[2] 开始是偏移量（整数，需除以1000000后累加）
 *
 * 官方解压代码:
 *   for (var i = 2; i < coors.length; i++) {
 *     coors[i] = Number(coors[i - 2]) + Number(coors[i]) / kr;
 *   }
 */
function fetchWalkingRouteFromTencent(from, to) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/direction/v1/walking',
      data: {
        key: MAP_KEY,
        from: from.lat + ',' + from.lng,
        to: to.lat + ',' + to.lng
      },
      success(res) {
        console.log('[map.js] 腾讯direction API status:', res.data && res.data.status)
        if (res.data && res.data.status === 0 && res.data.result) {
          const route = res.data.result.routes && res.data.result.routes[0]
          if (route && route.polyline) {
            // 官方前向差分解压算法
            var coors = route.polyline
            var kr = 1000000
            for (var i = 2; i < coors.length; i++) {
              coors[i] = Number(coors[i - 2]) + Number(coors[i]) / kr
            }
            // 将解压后的坐标放入点串数组
            var coords = []
            for (var i = 0; i < coors.length; i += 2) {
              coords.push({ latitude: coors[i], longitude: coors[i + 1] })
            }

            if (coords.length > 1) {
              console.log('[map.js] 解压成功, 共' + coords.length + '个点, 起点:', coords[0], '终点:', coords[coords.length - 1])
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
        // API返回错误（配额用完、权限问题等）
        var errMsg = res.data ? res.data.message : 'unknown'
        console.error('[map.js] 腾讯direction API错误:', res.data && res.data.status, errMsg)
        reject(new Error('腾讯direction API: ' + errMsg))
      },
      fail(err) {
        console.error('[map.js] 腾讯direction请求失败:', err)
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
