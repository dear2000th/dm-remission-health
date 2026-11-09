const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'remission_data.sqlite');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for high performance and integrity
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'nurse', 'patient')),
      full_name TEXT NOT NULL,
      email TEXT,
      failed_attempts INTEGER DEFAULT 0,
      locked_until DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hn TEXT UNIQUE NOT NULL,
      citizen_id TEXT UNIQUE,
      user_id INTEGER,
      full_name TEXT NOT NULL,
      gender TEXT CHECK(gender IN ('M', 'F', 'Other')),
      birth_date DATE,
      age INTEGER,
      initial_weight_kg REAL,
      target_weight_kg REAL,
      initial_hba1c REAL,
      program_start_date DATE NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'remission', 'monitoring', 'paused')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      week_number INTEGER NOT NULL CHECK(week_number BETWEEN 1 AND 20),
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
      record_date DATE,
      bp_systolic REAL,
      bp_diastolic REAL,
      glucose_first_meal_pre REAL,
      glucose_first_meal_post REAL,
      glucose_last_meal_pre REAL,
      glucose_last_meal_post REAL,
      step_count INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      UNIQUE(patient_id, week_number, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      role TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      patient_hn TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_records_patient ON health_records(patient_id, week_number);
    CREATE INDEX IF NOT EXISTS idx_patients_hn ON patients(hn);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  // Ensure citizen_id column exists
  try {
    const tableInfo = db.prepare('PRAGMA table_info(patients)').all();
    const hasCitizenId = tableInfo.some(col => col.name === 'citizen_id');
    if (!hasCitizenId) {
      db.exec(`ALTER TABLE patients ADD COLUMN citizen_id TEXT;`);
      console.log('Migration: Added citizen_id column to patients table.');
    }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_citizen_id ON patients(citizen_id);`);
  } catch (migErr) {
    console.warn('Migration note:', migErr.message);
  }

  console.log('Database schema verified & initialized successfully.');
}

module.exports = {
  db,
  initDatabase
};
