CREATE VIEW public_eligible_coach_reviews AS
SELECT r.* FROM coach_reviews r
JOIN booking_requests b ON b.id = r.booking_id AND b.coach_id = r.coach_id AND b.user_id = r.user_id
JOIN users u ON u.id = r.user_id
JOIN coaches c ON c.id = r.coach_id
JOIN entity_metric_classifications rproof ON rproof.entity_type = 'review' AND rproof.entity_id = r.id AND rproof.classification = 'production_eligible'
JOIN entity_metric_classifications bproof ON bproof.entity_type = 'booking' AND bproof.entity_id = b.id AND bproof.classification = 'production_eligible'
JOIN entity_metric_classifications uproof ON uproof.entity_type = 'user' AND uproof.entity_id = u.id AND uproof.classification = 'production_eligible'
JOIN entity_metric_classifications cproof ON cproof.entity_type = 'coach' AND cproof.entity_id = CAST(c.id AS TEXT) AND cproof.classification = 'production_eligible'
WHERE r.status = 'approved' AND b.status = 'completed' AND u.status = 'active'
  AND c.profile_kind = 'real' AND c.audit_status = 'approved' AND c.listing_status = 'online' AND c.city = '北京';
--> statement-breakpoint
CREATE TRIGGER metric_classification_events_no_update BEFORE UPDATE ON metric_classification_events
BEGIN SELECT RAISE(ABORT, 'classification events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER metric_classification_events_no_delete BEFORE DELETE ON metric_classification_events
BEGIN SELECT RAISE(ABORT, 'classification events are immutable'); END;
