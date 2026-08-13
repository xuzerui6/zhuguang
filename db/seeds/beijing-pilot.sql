-- Beijing pilot catalog. Real profiles contain only user-confirmed facts.
-- Demo records are visibly labelled and never receive bookings or coach roles.
INSERT INTO coaches (
  id, name, sport, city, district, level, title, bio, price_fen, trial_price_fen,
  rating_basis_points, lessons, review_count, experience_years, response_minutes,
  audience_json, goals_json, strengths_json, availability_summary_json,
  profile_kind, listing_status, listing_reason, listing_changed_by, listing_changed_at,
  pricing_status, audit_status, avatar_object_key, card_object_key, hero_object_key,
  created_at, updated_at
) VALUES
  (1, '演示教练 A01', '羽毛球', '北京', '朝阳区', '演示资料', '朝阳区羽毛球演示资料',
   '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。',
   0, 0, 0, 0, 0, 0, 0, '[]', '["羽毛球训练"]', '["羽毛球训练场景"]', '[]',
   'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved',
   'coaches/demo/public/badminton-v1.webp', 'coaches/demo/public/badminton-v1.webp', 'coaches/demo/public/badminton-v1.webp', 1786219200000, 1786219200000),
  (2, '演示教练 A02', '游泳', '北京', '海淀区', '演示资料', '海淀区游泳演示资料',
   '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。',
   0, 0, 0, 0, 0, 0, 0, '[]', '["游泳训练"]', '["游泳训练场景"]', '[]',
   'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved',
   'coaches/demo/public/swimming-v1.webp', 'coaches/demo/public/swimming-v1.webp', 'coaches/demo/public/swimming-v1.webp', 1786219200000, 1786219200000),
  (3, '演示教练 A03', '篮球', '北京', '东城区', '演示资料', '东城区篮球演示资料',
   '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。',
   0, 0, 0, 0, 0, 0, 0, '[]', '["篮球训练"]', '["篮球训练场景"]', '[]',
   'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved',
   'coaches/demo/public/basketball-v1.webp', 'coaches/demo/public/basketball-v1.webp', 'coaches/demo/public/basketball-v1.webp', 1786219200000, 1786219200000),
  (4, '演示教练 A04', '体能', '北京', '丰台区', '演示资料', '丰台区体能演示资料',
   '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。',
   0, 0, 0, 0, 0, 0, 0, '[]', '["体能训练"]', '["体能训练场景"]', '[]',
   'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved',
   'coaches/demo/public/conditioning-v1.webp', 'coaches/demo/public/conditioning-v1.webp', 'coaches/demo/public/conditioning-v1.webp', 1786219200000, 1786219200000),
  (5, '徐泽瑞', '田径', '北京', '通州区', '退役田径运动员', '田径专项训练教练',
   '面向青少年与成人提供田径基础、短跑动作、跑姿纠正和专项体能训练，服务区域为北京市通州区。',
   24000, 9900, 0, 0, 0, 0, 0, '["青少年","成人"]',
   '["中考体育","短跑专项","跑姿纠正","专项体能"]', '["短跑技术","起跑与加速","跑姿纠正","专项体能"]', '[]',
   'real', 'online', '平台试点上线', 'system', 1786219200000, 'published', 'approved',
   'coaches/5/public/avatar-v1.webp', 'coaches/5/public/card-v1.webp', 'coaches/5/public/hero-v1.webp', 1786219200000, 1786219200000),
  (6, '张展祁', '田径', '北京', '通州区', '资料待补充', '田径训练教练',
   '北京通州区田径教练。当前仅展示已确认的姓名、项目与服务区域，其他资料由平台核验后补充。',
   0, 0, 0, 0, 0, 0, 0, '[]', '["田径训练"]', '["田径训练"]', '[]',
   'real', 'online', '保守资料上线', 'system', 1786219200000, 'unavailable', 'approved',
   'coaches/6/public/avatar-v1.webp', 'coaches/6/public/card-v1.webp', 'coaches/6/public/hero-v1.webp', 1786219200000, 1786219200000),
  (7, '郝健壮', '田径', '北京', '通州区', '资料待补充', '田径训练教练',
   '北京通州区田径教练。当前仅展示已确认的姓名、项目与服务区域，其他资料由平台核验后补充。',
   0, 0, 0, 0, 0, 0, 0, '[]', '["田径训练"]', '["田径训练"]', '[]',
   'real', 'online', '保守资料上线', 'system', 1786219200000, 'unavailable', 'approved',
   'coaches/7/public/avatar-v1.webp', 'coaches/7/public/card-v1.webp', 'coaches/7/public/hero-v1.webp', 1786219200000, 1786219200000),
  (8, '演示教练 A05', '羽毛球', '北京', '顺义区', '演示资料', '顺义区羽毛球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["羽毛球训练"]', '["羽毛球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/badminton-v1.webp', 'coaches/demo/public/badminton-v1.webp', 'coaches/demo/public/badminton-v1.webp', 1786219200000, 1786219200000),
  (9, '演示教练 A06', '羽毛球', '北京', '怀柔区', '演示资料', '怀柔区羽毛球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["羽毛球训练"]', '["羽毛球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/badminton-v1.webp', 'coaches/demo/public/badminton-v1.webp', 'coaches/demo/public/badminton-v1.webp', 1786219200000, 1786219200000),
  (10, '演示教练 A07', '游泳', '北京', '昌平区', '演示资料', '昌平区游泳演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["游泳训练"]', '["游泳训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/swimming-v1.webp', 'coaches/demo/public/swimming-v1.webp', 'coaches/demo/public/swimming-v1.webp', 1786219200000, 1786219200000),
  (11, '演示教练 A08', '游泳', '北京', '密云区', '演示资料', '密云区游泳演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["游泳训练"]', '["游泳训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/swimming-v1.webp', 'coaches/demo/public/swimming-v1.webp', 'coaches/demo/public/swimming-v1.webp', 1786219200000, 1786219200000),
  (12, '演示教练 A09', '网球', '北京', '西城区', '演示资料', '西城区网球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["网球训练"]', '["网球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/tennis-v1.webp', 'coaches/demo/public/tennis-v1.webp', 'coaches/demo/public/tennis-v1.webp', 1786219200000, 1786219200000),
  (13, '演示教练 A10', '网球', '北京', '石景山区', '演示资料', '石景山区网球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["网球训练"]', '["网球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/tennis-v1.webp', 'coaches/demo/public/tennis-v1.webp', 'coaches/demo/public/tennis-v1.webp', 1786219200000, 1786219200000),
  (14, '演示教练 A11', '网球', '北京', '平谷区', '演示资料', '平谷区网球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["网球训练"]', '["网球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/tennis-v1.webp', 'coaches/demo/public/tennis-v1.webp', 'coaches/demo/public/tennis-v1.webp', 1786219200000, 1786219200000),
  (15, '演示教练 A12', '篮球', '北京', '大兴区', '演示资料', '大兴区篮球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["篮球训练"]', '["篮球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/basketball-v1.webp', 'coaches/demo/public/basketball-v1.webp', 'coaches/demo/public/basketball-v1.webp', 1786219200000, 1786219200000),
  (16, '演示教练 A13', '篮球', '北京', '房山区', '演示资料', '房山区篮球演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["篮球训练"]', '["篮球训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/basketball-v1.webp', 'coaches/demo/public/basketball-v1.webp', 'coaches/demo/public/basketball-v1.webp', 1786219200000, 1786219200000),
  (17, '演示教练 A14', '体能', '北京', '门头沟区', '演示资料', '门头沟区体能演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["体能训练"]', '["体能训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/conditioning-v1.webp', 'coaches/demo/public/conditioning-v1.webp', 'coaches/demo/public/conditioning-v1.webp', 1786219200000, 1786219200000),
  (18, '演示教练 A15', '体能', '北京', '延庆区', '演示资料', '延庆区体能演示资料', '用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。', 0, 0, 0, 0, 0, 0, 0, '[]', '["体能训练"]', '["体能训练场景"]', '[]', 'demo', 'online', '演示目录初始化', 'system', 1786219200000, 'unavailable', 'approved', 'coaches/demo/public/conditioning-v1.webp', 'coaches/demo/public/conditioning-v1.webp', 'coaches/demo/public/conditioning-v1.webp', 1786219200000, 1786219200000)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  sport = excluded.sport,
  city = excluded.city,
  district = excluded.district,
  level = excluded.level,
  title = excluded.title,
  bio = excluded.bio,
  price_fen = excluded.price_fen,
  trial_price_fen = excluded.trial_price_fen,
  rating_basis_points = excluded.rating_basis_points,
  lessons = excluded.lessons,
  review_count = excluded.review_count,
  experience_years = excluded.experience_years,
  response_minutes = excluded.response_minutes,
  audience_json = excluded.audience_json,
  goals_json = excluded.goals_json,
  strengths_json = excluded.strengths_json,
  availability_summary_json = excluded.availability_summary_json,
  profile_kind = excluded.profile_kind,
  pricing_status = excluded.pricing_status,
  avatar_object_key = excluded.avatar_object_key,
  card_object_key = excluded.card_object_key,
  hero_object_key = excluded.hero_object_key,
  updated_at = excluded.updated_at;

UPDATE coaches SET user_id = NULL, siwc_email = NULL WHERE profile_kind = 'demo';
DELETE FROM availability_slots WHERE coach_id IN (SELECT id FROM coaches WHERE profile_kind = 'demo');
DELETE FROM coach_credentials WHERE coach_id IN (SELECT id FROM coaches WHERE profile_kind = 'demo');
DELETE FROM venues WHERE coach_id IN (SELECT id FROM coaches WHERE profile_kind = 'demo');

INSERT INTO venues (id, coach_id, name, address, city, district, active, created_at) VALUES
  ('venue-tongzhou-track', 5, '北京市通州区合作训练场', '通州区 · 具体场地预约后确认', '北京', '通州区', 1, 1786219200000)
ON CONFLICT(id) DO UPDATE SET
  coach_id = excluded.coach_id,
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  district = excluded.district,
  active = excluded.active;

-- Verified public profiles. These facts were supplied and confirmed by the platform owner.
UPDATE coaches SET
  siwc_email = 'xuzerui6@gmail.com', level = '退役运动员', title = '田径专项训练教练',
  bio = '退役运动员，拥有2年执教经验，面向青少年儿童与成人提供体能提升及中小学体育中高考训练。',
  price_fen = 24000, trial_price_fen = 9900, experience_years = 2,
  audience_json = '["青少年儿童","成人"]', goals_json = '["体能提升","中小学体育中高考"]',
  strengths_json = '["体能提升","中小学体育中高考"]',
  honors_json = '["北京市400米冠军","北京市800米冠军","全国中学生前八"]',
  credentials_json = '["国家级教练证书"]', motto = '身体扛不住的时候换意志杀出重围',
  pricing_status = 'published', audit_status = 'approved', updated_at = 1786723200000 WHERE id = 5;

UPDATE coaches SET
  level = '退役运动员', title = '田赛专项训练教练',
  bio = '退役运动员，拥有1年执教经验，面向青少年儿童与成人提供跳远、跳高及各类田项训练。',
  price_fen = 24000, trial_price_fen = 9900, experience_years = 1,
  audience_json = '["青少年儿童","成人"]', goals_json = '["跳远","跳高","各类田项"]',
  strengths_json = '["跳远","跳高","田赛专项"]', honors_json = '["全国中学生第四","北京市前三"]',
  credentials_json = '["体适能教练"]', motto = '专业的事情交给专业的人',
  pricing_status = 'published', audit_status = 'approved', updated_at = 1786723200000 WHERE id = 6;

UPDATE coaches SET
  level = '退役运动员', title = '田径专项训练教练',
  bio = '退役运动员，拥有3年执教经验，面向青少年儿童与成人提供体育中高考、体能提升和专项训练。',
  price_fen = 24000, trial_price_fen = 9900, experience_years = 3,
  audience_json = '["青少年儿童","成人"]', goals_json = '["体育中高考","体能提升","专项训练"]',
  strengths_json = '["体育中高考","体能提升","专项训练"]',
  honors_json = '["北京市400米跨栏冠军","北京市400米跨栏纪录保持者"]',
  credentials_json = '["体育教师证书","体适能证书","国家级教练员证书"]',
  motto = '没有带不出的学生，只有不合格的教练', pricing_status = 'published', audit_status = 'approved',
  updated_at = 1786723200000 WHERE id = 7;

INSERT INTO venues (id, coach_id, name, address, city, district, active, created_at) VALUES
  ('venue-tongzhou-track-zhang', 6, '北京市通州区合作训练场', '通州区 · 具体场地预约后确认', '北京', '通州区', 1, 1786723200000),
  ('venue-tongzhou-track-hao', 7, '北京市通州区合作训练场', '通州区 · 具体场地预约后确认', '北京', '通州区', 1, 1786723200000)
ON CONFLICT(id) DO UPDATE SET name = excluded.name, address = excluded.address, active = excluded.active;
