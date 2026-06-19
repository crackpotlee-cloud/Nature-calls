-- ============================================================
-- 三急 (SanJi) — 厕所实时资源调度引擎
-- PostgreSQL + PostGIS 数据库建表脚本
-- ============================================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- -----------------------------------------------------------
-- 1. toilets — 厕所主表
-- -----------------------------------------------------------
CREATE TABLE toilets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 基本信息
    name            VARCHAR(100)  NOT NULL,
    type            VARCHAR(20)   NOT NULL CHECK (type IN (
                        '公厕', '商场厕所', '地铁厕所', '餐饮厕所',
                        '公园厕所', '加油站厕所', '酒店厕所', '医院厕所'
                    )),

    -- 建筑坐标 (WGS84)
    lat             DECIMAL(10,7) NOT NULL,
    lng             DECIMAL(10,7) NOT NULL,

    -- 入口坐标 (导航终点)
    entry_lat       DECIMAL(10,7) NOT NULL,
    entry_lng       DECIMAL(10,7) NOT NULL,

    -- 位置锚点
    landmark        VARCHAR(50),
    floor           VARCHAR(10),

    -- 路径指引
    direction       TEXT,

    -- 准入类型
    access_type     VARCHAR(20)   NOT NULL DEFAULT '自由进入' CHECK (access_type IN (
                        '自由进入', '需安检', '建议消费', '必须消费',
                        '需门禁', '需密码', '需登记'
                    )),

    -- 设施
    has_baby_station  BOOLEAN NOT NULL DEFAULT FALSE,
    has_accessible    BOOLEAN NOT NULL DEFAULT FALSE,
    has_squat         BOOLEAN NOT NULL DEFAULT TRUE,
    has_seat          BOOLEAN NOT NULL DEFAULT TRUE,
    has_paper         BOOLEAN NOT NULL DEFAULT FALSE,
    has_soap          BOOLEAN NOT NULL DEFAULT FALSE,
    has_hand_dryer    BOOLEAN NOT NULL DEFAULT FALSE,

    -- 运营时间
    operating_type    VARCHAR(20) NOT NULL DEFAULT '24小时' CHECK (operating_type IN (
                        '24小时', '跟随商场', '固定时间'
                    )),
    open_time         TIME,
    close_time        TIME,

    -- 状态缓存 (由 status_engine 计算并写入)
    status_color        VARCHAR(10)  CHECK (status_color IN ('green', 'yellow', 'red')),
    status_confidence   INTEGER      CHECK (status_confidence BETWEEN 0 AND 100),
    status_updated_at   TIMESTAMP WITH TIME ZONE,

    -- 元数据
    contributor_id    VARCHAR(64),
    verified          BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by       VARCHAR(64),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 地理空间列 (PostGIS)
SELECT AddGeometryColumn('toilets', 'geom', 4326, 'POINT', 2);
SELECT AddGeometryColumn('toilets', 'entry_geom', 4326, 'POINT', 2);

-- 填充几何列 (通过 lat/lng 自动计算)
CREATE OR REPLACE FUNCTION toilets_update_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    NEW.entry_geom := ST_SetSRID(ST_MakePoint(NEW.entry_lng, NEW.entry_lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_toilets_geom
    BEFORE INSERT OR UPDATE OF lat, lng, entry_lat, entry_lng ON toilets
    FOR EACH ROW EXECUTE FUNCTION toilets_update_geom();

-- 索引
CREATE INDEX idx_toilets_type        ON toilets(type);
CREATE INDEX idx_toilets_status      ON toilets(status_color);
CREATE INDEX idx_toilets_operating   ON toilets(operating_type);
CREATE INDEX idx_toilets_geom        ON toilets USING GIST(geom);
CREATE INDEX idx_toilets_entry_geom  ON toilets USING GIST(entry_geom);
CREATE INDEX idx_toilets_created_at  ON toilets(created_at);

-- -----------------------------------------------------------
-- 2. feedbacks — 反馈表
-- -----------------------------------------------------------
CREATE TABLE feedbacks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    toilet_id       UUID NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
    user_open_id    VARCHAR(64) NOT NULL,

    -- 反馈内容
    status          VARCHAR(20) NOT NULL CHECK (status IN ('available', 'unavailable')),
    cleanliness     VARCHAR(10) CHECK (cleanliness IN ('good', 'ok', 'bad')),
    queue           VARCHAR(10) CHECK (queue IN ('empty', 'few', 'long')),
    paper           VARCHAR(10) CHECK (paper IN ('yes', 'low', 'no')),

    -- 位置校验
    user_lat        DECIMAL(10,7),
    user_lng        DECIMAL(10,7),
    location_match  BOOLEAN DEFAULT TRUE,

    -- 信任分
    trust_score     INTEGER NOT NULL DEFAULT 0,

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_feedbacks_toilet     ON feedbacks(toilet_id);
CREATE INDEX idx_feedbacks_user       ON feedbacks(user_open_id);
CREATE INDEX idx_feedbacks_status     ON feedbacks(status);
CREATE INDEX idx_feedbacks_created    ON feedbacks(created_at DESC);
CREATE INDEX idx_feedbacks_toilet_ts  ON feedbacks(toilet_id, created_at DESC);

-- -----------------------------------------------------------
-- 3. users — 用户表
-- -----------------------------------------------------------
CREATE TABLE users (
    open_id         VARCHAR(64) PRIMARY KEY,

    -- 信用体系
    trust_score     INTEGER NOT NULL DEFAULT 60 CHECK (trust_score BETWEEN 0 AND 100),
    feedback_count  INTEGER NOT NULL DEFAULT 0,
    accepted_count  INTEGER NOT NULL DEFAULT 0,
    contribute_count INTEGER NOT NULL DEFAULT 0,

    -- 角色等级
    role            VARCHAR(4) NOT NULL DEFAULT 'L1' CHECK (role IN ('L1', 'L2', 'L3', 'L4')),

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_trust ON users(trust_score DESC);

-- -----------------------------------------------------------
-- 4. corrections — 纠错表
-- -----------------------------------------------------------
CREATE TABLE corrections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    toilet_id       UUID NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
    user_open_id    VARCHAR(64) NOT NULL,

    field           VARCHAR(30) NOT NULL,
    old_value       TEXT,
    new_value       TEXT NOT NULL,

    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'approved', 'rejected'
                    )),

    reviewer_id     VARCHAR(64),
    review_note     TEXT,

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_corrections_toilet ON corrections(toilet_id);
CREATE INDEX idx_corrections_status ON corrections(status);

-- -----------------------------------------------------------
-- 触发器: updated_at 自动更新
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_toilets_updated_at
    BEFORE UPDATE ON toilets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
