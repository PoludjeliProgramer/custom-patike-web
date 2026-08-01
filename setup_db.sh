#!/bin/bash
sudo -u postgres psql -c "CREATE DATABASE custompatike;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER custompatike_user WITH PASSWORD 'CustomPatike2026!';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE custompatike TO custompatike_user;"
sudo -u postgres psql -d custompatike -f /tmp/schema.sql
sudo -u postgres psql -d custompatike -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO custompatike_user; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO custompatike_user;"
echo "DB_SETUP_SUCCESSFUL"
