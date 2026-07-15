-- F10 — Worker assignment.
-- Admins assign a specific worker (from the complaint's department) with an
-- expected arrival window; the student sees who is coming and when.

CREATE TABLE IF NOT EXISTS workers (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  role         TEXT NOT NULL,          -- e.g. Plumber, Electrician, Network Technician
  department   TEXT NOT NULL,          -- matches complaints.department
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  id           SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  worker_id    INTEGER NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  assigned_by  INTEGER NOT NULL REFERENCES users(id),
  eta_start    TIMESTAMPTZ,
  eta_end      TIMESTAMPTZ,
  note         TEXT,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Newest assignment per complaint = the current one.
CREATE INDEX IF NOT EXISTS idx_assignments_complaint ON assignments (complaint_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_workers_department ON workers (department);

-- Seed a small roster so the feature is demoable (2–3 per department).
INSERT INTO workers (name, phone, role, department) VALUES
  ('Ramesh Patel',   '+91 98250 11223', 'Plumber',                'Maintenance'),
  ('Suresh Yadav',   '+91 98250 44556', 'Electrician',            'Maintenance'),
  ('Mahesh Solanki', '+91 98250 77889', 'Maintenance Technician', 'Maintenance'),
  ('Karan Mehta',    '+91 90990 12345', 'Network Technician',     'IT'),
  ('Priya Nair',     '+91 90990 67890', 'IT Support',             'IT'),
  ('Lata Devi',      '+91 96380 22446', 'Housekeeping Staff',     'Housekeeping'),
  ('Anil Kumar',     '+91 96380 88664', 'Housekeeping Supervisor','Housekeeping'),
  ('Neha Shah',      '+91 79840 55667', 'Front Office Executive', 'Front Office'),
  ('Vikram Rao',     '+91 79840 33221', 'Facilities Coordinator', 'Front Office');
