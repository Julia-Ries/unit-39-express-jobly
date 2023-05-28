
const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");


class Job{
 
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, compnay_handle }
   *
   * Returns { id, title, salary, equity, compnay_handle }
   *
   * */
  
  static async create(data){
    const result = await db.query(
        `INSERT INTO jobs (title, salary, equity, company_handle)
        VALUES ($1, $2, $3, $4)
        RETURNING title, salary, equity, company_handle AS "companyHandle"`,
        [data.title,
        data.salary,
        data.equity,
        data.companyHandle]);
    
    const job = result.rows[0];
    return job;
  };


   /** Find all jobs.
   * 
   * searchFilters:
   * -title,
   * -minSalary
   * -hasEquity
   *
   * Returns [{ id, title, salary,equity, companyHandle }, ...]
   * */

  static async findAll({ title, minSalary, hasEquity}){
    const query = 
    `SELECT 
    j.id,
    j.title, 
    j.salary,
    j.equity,
    j.company_handle AS "companyHandle",
    c.name AS "companyName"
    FROM jobs j
    LEFT JOIN companies AS c ON c.handle = j.company_handle`;

    let whereExpressions = [];
    let queryValues = [];

    if(minSalary !== undefined) {
        queryValues.push(minSalary);
        whereExpressions.push(`minSalary >= $${queryValues.length}`);
    }

    if(hasEquity == true){
        whereExpressions.push(`equity > 0`);
    }

    if(title) {
        queryValues.push(`%${title}`);
        whereExpressions.push(`title ILIKE $${queryValues.length}`);
    }

    if (whereExpressions.length > 0) {
        query += " WHERE " + whereExpressions.join(" AND ");
    }

    query += "ORDER BY title;"

    const jobRes = await db.query(query, queryValues);
    return jobRes.rows;
}

/** Given a job id return data about job.
   *
   * Returns { id, title, equity, salary, companyHandle, compnayName}
   *   where company is { handle, name, description, numEmployees, logoUrl }
   *
   * Throws NotFoundError if not found.
   **/

static async get(id){
    const jobRes = await db.query(
        `SELECT id, 
        title, 
        equity,
        salary,
        company_handle AS "compnayHandle"
        FROM jobs
        WHERE id=$1`, 
        [id]);
    
    const job = jobRes.rows[0];
    
    if(!job) throw new NotFoundError(`No job: ${id}`);

    const companyRes = await db.query(
        `SELECT handle,
                name,
                description,
                num_employees AS "numEmployees",
                logo_url AS "logoUrl"
         FROM companies
         WHERE handle = $1`,
      [job.companyHandle]);

    delete job.companyHandle;
    job.company = companyRes.rows[0];

    return job;
}

/** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, salary, equity }
   *
   * Returns {id, title, salary, equity, company_handle}
   *
   * Throws NotFoundError if not found.
   */
  static async update(id, data){
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {});
    const idVarIdx = "$" + (values.length + 1);

    const query = `UPDATE jobs
    SET ${setCols}
    WHERE id = ${idVarIdx}
    RETURNING id,
    title,
    salary,
    equity,
    company_handle AS "companyHandle"`;

    const result = await db.query(query, [...values, id]);
    const job = result.rows[0];

    if(!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }


  /** Delete given jpb from database; returns undefined.
   *
   * Throws NotFoundError if job not found.
   **/

  static async remove(id){
    const result = await db.query(
        `DELETE FROM jobs
        WHERE id = $1
        RETURNING id`, [id]);

    const job = result.rows[0];
     if(!job) throw new NotFoundError(`No job: ${id}`)
  }

}

module.exports = Job;

