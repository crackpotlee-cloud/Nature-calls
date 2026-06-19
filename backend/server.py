"""
三急 · 后端API服务（Flask最小化版本）
"""
from flask import Flask, request, jsonify
import sys
sys.path.insert(0, '/workspace/backend')
from status_engine import calculate_status
from recommend_engine import recommend, _make_mock_candidates, UserContext, SceneMode
from datetime import datetime

app = Flask(__name__)
MOCK = _make_mock_candidates()

@app.route('/api/toilet/nearby', methods=['POST'])
def nearby():
    data = request.get_json() or {}
    lat = data.get('lat', 30.6586)
    lng = data.get('lng', 104.0817)
    scene = data.get('scene', 'smart')

    mode = SceneMode.SMART
    if scene == 'diarrhea': mode = SceneMode.DIARRHEA
    elif scene == 'kids': mode = SceneMode.KIDS

    ctx = UserContext(lat=lat, lng=lng, current_time=datetime.now())
    result = recommend(MOCK, ctx, mode, top_k=5)

    def to_dict(c):
        return {
            'toilet_id': c.toilet_id,
            'name': c.name,
            'type': c.type,
            'entry_lat': c.entry_lat,
            'entry_lng': c.entry_lng,
            'walk_time': int(c.walk_time_min * 60),
            'walk_distance': int(c.distance_m),
            'status': {'color': c.status_color, 'confidence': c.status_confidence},
            'access_type': getattr(c, 'access_type', '自由进入'),
            'has_paper': c.has_paper,
            'has_baby_station': c.has_baby_station,
            'landmark': getattr(c, 'landmark', ''),
            'floor': getattr(c, 'floor', ''),
            'direction': getattr(c, 'direction', ''),
            'score': round(c.final_score, 2)
        }

    candidates = [to_dict(c) for c in result.candidates]
    return jsonify({'code': 0, 'data': {
        'recommend': candidates[0] if candidates else None,
        'alternatives': candidates[1:] if len(candidates) > 1 else [],
        'total': result.total_candidates,
        'filtered': result.filtered_count
    }})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': '三急后端API', 'toilets': len(MOCK)})

if __name__ == '__main__':
    print(f"🚀 三急后端API: http://0.0.0.0:5000 ({len(MOCK)}个厕所)")
    app.run(host='0.0.0.0', port=5000, debug=False)
