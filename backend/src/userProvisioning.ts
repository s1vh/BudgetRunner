import type { DbClient } from './db.js'

const defaultCategories = [
  ['Combustible de Neón', 'fuel', '#FF007F'],
  ['Raciones Orbitales', 'utensils', '#00FFFF'],
  ['Mantenimiento del Hovercar', 'wrench', '#8B00FF'],
  ['Suscripciones de la Red', 'radio', '#A69DFF'],
  ['Ocio Holográfico', 'gamepad', '#F785C6'],
  ['Salud Biónica', 'heart-pulse', '#FF6E84'],
  ['Vivienda en la Megaciudad', 'building', '#FFD43F'],
  ['Tecnología del Cyberdeck', 'cpu', '#7DD3FC'],
  ['Otros', 'shapes', '#986780'],
] as const

export async function provisionNewUser(client: DbClient, userId: string) {
  await client.query('INSERT INTO user_progress (user_id) VALUES ($1)', [userId])
  for (const [name, icon, color] of defaultCategories) {
    await client.query(`
      INSERT INTO categories (user_id, name, icon_key, color_token, is_system_seed)
      VALUES ($1, $2, $3, $4, true)
    `, [userId, name, icon, color])
  }
}
