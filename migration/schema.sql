CREATE TYPE shift_enum AS ENUM ('A', 'B');
CREATE TYPE status_enum AS ENUM ('OK', 'NG', '-');
CREATE TYPE signature_status_enum AS ENUM ('APPROVED', 'REJECTED', '-');
CREATE TYPE table_type_enum AS ENUM ('type1', 'type2');
CREATE TYPE area_type_enum AS ENUM ('pre-assy', 'final-assy');

CREATE TABLE users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    nik VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE checklist_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    table_type table_type_enum NOT NULL,
    area_type area_type_enum NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

CREATE TABLE checklist_areas (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    area_code VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, area_code),
    FOREIGN KEY (category_id) REFERENCES checklist_categories(id) ON DELETE CASCADE
);

CREATE TABLE checklist_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    item_no VARCHAR(10),
    check_point TEXT NOT NULL,
    standard TEXT,
    waktu_check VARCHAR(100),
    shift shift_enum NOT NULL,
    machine VARCHAR(100),
    kind VARCHAR(100),
    size VARCHAR(20),
    item_check VARCHAR(255),
    method VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    area_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES checklist_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES checklist_areas(id) ON DELETE SET NULL
);

CREATE TABLE checklist_results (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    nik VARCHAR(50) NOT NULL,
    category_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    date_key VARCHAR(10) NOT NULL,
    shift shift_enum NOT NULL,
    status status_enum DEFAULT '-',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES checklist_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES checklist_items(id) ON DELETE CASCADE
);

