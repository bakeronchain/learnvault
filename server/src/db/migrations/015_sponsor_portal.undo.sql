DROP TRIGGER IF EXISTS trg_scholar_regions_updated_at ON scholar_regions;
DROP FUNCTION IF EXISTS set_scholar_regions_updated_at();

DROP TRIGGER IF EXISTS trg_sponsor_organizations_updated_at ON sponsor_organizations;
DROP FUNCTION IF EXISTS set_sponsor_organizations_updated_at();

DROP TABLE IF EXISTS scholar_regions;
DROP TABLE IF EXISTS sponsor_track_donations;
DROP TABLE IF EXISTS sponsor_organizations;
