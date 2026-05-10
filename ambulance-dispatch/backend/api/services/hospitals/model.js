const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../../utils/errors');

class HospitalModel {
  static async create(hospitalData) {
    const id = uuidv4();
    const query = `
      INSERT INTO hospitals (
        id, name, address, latitude, longitude, phone, email,
        total_beds, icu_beds, trauma_bays, available_beds, available_icu_beds,
        available_trauma_bays, trauma_level, status, services, equipment,
        blood_inventory, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      id,
      hospitalData.name,
      hospitalData.address,
      hospitalData.latitude,
      hospitalData.longitude,
      hospitalData.phone,
      hospitalData.email,
      hospitalData.total_beds || 0,
      hospitalData.icu_beds || 0,
      hospitalData.trauma_bays || 0,
      hospitalData.total_beds || 0,
      hospitalData.icu_beds || 0,
      hospitalData.trauma_bays || 0,
      hospitalData.trauma_level || null,
      hospitalData.status || 'active',
      JSON.stringify(hospitalData.services || []),
      JSON.stringify(hospitalData.equipment || {}),
      JSON.stringify(hospitalData.blood_inventory || {}),
    ];

    const result = await db.query(query, values);
    return this.formatHospital(result.rows[0]);
  }

  static async findById(id) {
    const query = 'SELECT * FROM hospitals WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Hospital not found');
    }

    return this.formatHospital(result.rows[0]);
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM hospitals WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.trauma_level) {
      query += ` AND trauma_level = $${paramCount}`;
      values.push(filters.trauma_level);
      paramCount++;
    }

    if (filters.service) {
      query += ` AND services::jsonb ? $${paramCount}`;
      values.push(filters.service);
      paramCount++;
    }

    query += ' ORDER BY name ASC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramCount}`;
      values.push(filters.offset);
      paramCount++;
    }

    const result = await db.query(query, values);
    return result.rows.map(row => this.formatHospital(row));
  }

  static async findNearby(latitude, longitude, radiusKm = 50, filters = {}) {
    let query = `
      SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance
      FROM hospitals
      WHERE status = 'active'
    `;
    const values = [latitude, longitude];
    let paramCount = 3;

    if (filters.min_beds) {
      query += ` AND available_beds >= $${paramCount}`;
      values.push(filters.min_beds);
      paramCount++;
    }

    if (filters.min_icu_beds) {
      query += ` AND available_icu_beds >= $${paramCount}`;
      values.push(filters.min_icu_beds);
      paramCount++;
    }

    if (filters.trauma_bay_required) {
      query += ` AND available_trauma_bays > 0`;
    }

    if (filters.trauma_level) {
      query += ` AND trauma_level = $${paramCount}`;
      values.push(filters.trauma_level);
      paramCount++;
    }

    if (filters.service) {
      query += ` AND services::jsonb ? $${paramCount}`;
      values.push(filters.service);
      paramCount++;
    }

    if (filters.blood_type) {
      query += ` AND blood_inventory::jsonb->$${paramCount} IS NOT NULL 
                 AND (blood_inventory::jsonb->>$${paramCount})::int > 0`;
      values.push(filters.blood_type);
      paramCount++;
    }

    if (filters.equipment) {
      query += ` AND equipment::jsonb->$${paramCount} = 'true'`;
      values.push(filters.equipment);
      paramCount++;
    }

    query += `
      HAVING (6371 * acos(
        cos(radians($1)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(latitude))
      )) <= $${paramCount}
      ORDER BY distance ASC
    `;
    values.push(radiusKm);

    if (filters.limit) {
      query += ` LIMIT ${filters.limit}`;
    }

    const result = await db.query(query, values);
    return result.rows.map(row => this.formatHospital(row));
  }

  static async update(id, updates) {
    const allowedFields = [
      'name', 'address', 'latitude', 'longitude', 'phone', 'email',
      'total_beds', 'icu_beds', 'trauma_bays', 'trauma_level', 'status',
      'services', 'equipment'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        
        if (key === 'services' || key === 'equipment') {
          values.push(JSON.stringify(updates[key]));
        } else {
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (setClauses.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE hospitals
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Hospital not found');
    }

    return this.formatHospital(result.rows[0]);
  }

  static async updateBedAvailability(id, bedUpdates) {
    const query = `
      UPDATE hospitals
      SET 
        available_beds = COALESCE($2, available_beds),
        available_icu_beds = COALESCE($3, available_icu_beds),
        available_trauma_bays = COALESCE($4, available_trauma_bays),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      bedUpdates.available_beds,
      bedUpdates.available_icu_beds,
      bedUpdates.available_trauma_bays
    ];

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Hospital not found');
    }

    return this.formatHospital(result.rows[0]);
  }

  static async updateBloodInventory(id, bloodInventory) {
    const query = `
      UPDATE hospitals
      SET 
        blood_inventory = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id, JSON.stringify(bloodInventory)]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Hospital not found');
    }

    return this.formatHospital(result.rows[0]);
  }

  static formatHospital(row) {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      location: {
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      },
      contact: {
        phone: row.phone,
        email: row.email,
      },
      capacity: {
        beds: {
          total: row.total_beds,
          available: row.available_beds,
          occupied: row.total_beds - row.available_beds,
        },
        icu: {
          total: row.icu_beds,
          available: row.available_icu_beds,
          occupied: row.icu_beds - row.available_icu_beds,
        },
        trauma: {
          total: row.trauma_bays,
          available: row.available_trauma_bays,
          occupied: row.trauma_bays - row.available_trauma_bays,
        },
      },
      trauma_level: row.trauma_level,
      status: row.status,
      services: typeof row.services === 'string' ? JSON.parse(row.services) : row.services,
      equipment: typeof row.equipment === 'string' ? JSON.parse(row.equipment) : row.equipment,
      blood_inventory: typeof row.blood_inventory === 'string' 
        ? JSON.parse(row.blood_inventory) 
        : row.blood_inventory,
      distance: row.distance ? parseFloat(row.distance).toFixed(2) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  static async getTotalCount(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM hospitals WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    const result = await db.query(query, values);
    return parseInt(result.rows[0].count);
  }
}

module.exports = HospitalModel;
