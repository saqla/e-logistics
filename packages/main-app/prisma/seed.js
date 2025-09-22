/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * 初期スタッフ一覧
 * [name, kind]
 */
const initialStaff = [
  ['禅院', 'ALL'],
  ['春口', 'ALL'],
  ['伊藤', 'ALL'],
  ['政池', 'UNIC'],
  ['林', 'UNIC'],
  ['一ノ瀬', 'UNIC'],
  ['小嶋', 'UNIC'],
  ['才木', 'UNIC'],
  ['平野', 'UNIC'],
  ['宮地', 'UNIC'],
  ['丸山', 'HAKO'],
  ['坂下', 'HAKO'],
  ['田中', 'HAKO'],
  ['相良', 'JIMU']
]

async function main() {
  console.log('Seeding staff...')

  for (const [name, kind] of initialStaff) {
    // 既に同名・未削除のレコードがある場合はスキップ
    const exists = await prisma.staff.findFirst({
      where: { name, deletedAt: null }
    })
    if (exists) {
      console.log(`Skip existing: ${name}`)
      continue
    }
    await prisma.staff.create({
      data: {
        name,
        kind
      }
    })
    console.log(`Created: ${name} (${kind})`)
  }

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


