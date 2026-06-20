sed -i 's/comparePrice: item.comparePrice || 0,/comparePrice: Number(item.comparePrice) || 0,/g' src/services/db.ts
