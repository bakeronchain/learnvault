-- Undo Migration 025: Quadratic-funding rounds
DROP TABLE IF EXISTS qf_contributions;
DROP TABLE IF EXISTS qf_rounds;
