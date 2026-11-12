-- Migrasi 010: Mendukung hingga maksimal 3 pemain (slot 0, 1, 2) di Monster Quiz Battle
ALTER TABLE quiz_room_players DROP CONSTRAINT IF EXISTS quiz_room_players_slot_check;
ALTER TABLE quiz_room_players ADD CONSTRAINT quiz_room_players_slot_check CHECK (slot IN (0, 1, 2));

ALTER TABLE quiz_match_players DROP CONSTRAINT IF EXISTS quiz_match_players_slot_check;
ALTER TABLE quiz_match_players ADD CONSTRAINT quiz_match_players_slot_check CHECK (slot IN (0, 1, 2));

