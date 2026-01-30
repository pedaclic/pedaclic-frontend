/**
 * MIGRATION : Ajouter coefficients et volumes horaires aux disciplines
 * À exécuter UNE FOIS dans la console du navigateur
 */

async function migrerDisciplines() {
  console.log('🚀 Début de la migration...');
  
  // Coefficients et volumes horaires par défaut selon le système éducatif sénégalais
  const CONFIGS_PAR_DISCIPLINE = {
    // ========== LANGUES ==========
    'francais': {
      coefficients: { '6ème': 5, '5ème': 5, '4ème': 5, '3ème': 5, 'Seconde': 4, 'Première': 4, 'Terminale': 5 },
      volumeHoraire: { '6ème': '5h', '5ème': '5h', '4ème': '5h', '3ème': '5h', 'Seconde': '4h', 'Première': '4h', 'Terminale': '5h' }
    },
    'anglais': {
      coefficients: { '6ème': 3, '5ème': 3, '4ème': 3, '3ème': 3, 'Seconde': 3, 'Première': 3, 'Terminale': 4 },
      volumeHoraire: { '6ème': '3h', '5ème': '3h', '4ème': '3h', '3ème': '3h', 'Seconde': '3h', 'Première': '3h', 'Terminale': '4h' }
    },
    'allemand': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 2, 'Seconde': 3, 'Première': 3, 'Terminale': 3 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '2h', 'Seconde': '3h', 'Première': '3h', 'Terminale': '3h' }
    },
    'arabe': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 2, 'Seconde': 2, 'Première': 2, 'Terminale': 2 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '2h', 'Seconde': '2h', 'Première': '2h', 'Terminale': '2h' }
    },
    'espagnol': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 2, 'Seconde': 3, 'Première': 3, 'Terminale': 3 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '2h', 'Seconde': '3h', 'Première': '3h', 'Terminale': '3h' }
    },
    'italien': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 2, 'Seconde': 2, 'Première': 2, 'Terminale': 2 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '2h', 'Seconde': '2h', 'Première': '2h', 'Terminale': '2h' }
    },
    'grec': {
      coefficients: { '6ème': 1, '5ème': 1, '4ème': 1, '3ème': 1, 'Seconde': 2, 'Première': 2, 'Terminale': 3 },
      volumeHoraire: { '6ème': '1h', '5ème': '1h', '4ème': '1h', '3ème': '1h', 'Seconde': '2h', 'Première': '2h', 'Terminale': '3h' }
    },
    'latin': {
      coefficients: { '6ème': 1, '5ème': 1, '4ème': 1, '3ème': 1, 'Seconde': 2, 'Première': 2, 'Terminale': 3 },
      volumeHoraire: { '6ème': '1h', '5ème': '1h', '4ème': '1h', '3ème': '1h', 'Seconde': '2h', 'Première': '2h', 'Terminale': '3h' }
    },
    'portugais': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 2, 'Seconde': 2, 'Première': 2, 'Terminale': 2 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '2h', 'Seconde': '2h', 'Première': '2h', 'Terminale': '2h' }
    },
    
    // ========== SCIENCES ==========
    'maths': {
      coefficients: { '6ème': 4, '5ème': 4, '4ème': 4, '3ème': 4, 'Seconde': 4, 'Première': 5, 'Terminale': 7 },
      volumeHoraire: { '6ème': '4h', '5ème': '4h', '4ème': '4h', '3ème': '4h', 'Seconde': '4h', 'Première': '5h', 'Terminale': '6h' }
    },
    'pc': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 3, '3ème': 3, 'Seconde': 3, 'Première': 4, 'Terminale': 5 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '3h', '3ème': '3h', 'Seconde': '3h', 'Première': '4h', 'Terminale': '5h' }
    },
    'svt': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 3, 'Seconde': 3, 'Première': 4, 'Terminale': 5 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '3h', 'Seconde': '3h', 'Première': '4h', 'Terminale': '4h' }
    },
    'mecanique': {
      coefficients: { '6ème': 0, '5ème': 0, '4ème': 0, '3ème': 0, 'Seconde': 2, 'Première': 3, 'Terminale': 4 },
      volumeHoraire: { '6ème': '0h', '5ème': '0h', '4ème': '0h', '3ème': '0h', 'Seconde': '2h', 'Première': '3h', 'Terminale': '4h' }
    },
    
    // ========== SCIENCES HUMAINES ==========
    'histo-geo': {
      coefficients: { '6ème': 3, '5ème': 3, '4ème': 3, '3ème': 3, 'Seconde': 3, 'Première': 4, 'Terminale': 4 },
      volumeHoraire: { '6ème': '3h', '5ème': '3h', '4ème': '3h', '3ème': '3h', 'Seconde': '3h', 'Première': '4h', 'Terminale': '4h' }
    },
    'philosophie': {
      coefficients: { '6ème': 0, '5ème': 0, '4ème': 0, '3ème': 0, 'Seconde': 2, 'Première': 3, 'Terminale': 4 },
      volumeHoraire: { '6ème': '0h', '5ème': '0h', '4ème': '0h', '3ème': '0h', 'Seconde': '2h', 'Première': '3h', 'Terminale': '4h' }
    },
    
    // ========== GESTION ==========
    'eco-gestion': {
      coefficients: { '6ème': 0, '5ème': 0, '4ème': 0, '3ème': 0, 'Seconde': 2, 'Première': 3, 'Terminale': 4 },
      volumeHoraire: { '6ème': '0h', '5ème': '0h', '4ème': '0h', '3ème': '0h', 'Seconde': '2h', 'Première': '3h', 'Terminale': '4h' }
    },
    
    // ========== SPORTS ==========
    'eps': {
      coefficients: { '6ème': 2, '5ème': 2, '4ème': 2, '3ème': 2, 'Seconde': 2, 'Première': 2, 'Terminale': 2 },
      volumeHoraire: { '6ème': '2h', '5ème': '2h', '4ème': '2h', '3ème': '2h', 'Seconde': '2h', 'Première': '2h', 'Terminale': '2h' }
    },
    
    // ========== ÉVEIL ==========
    'arts-plastiques': {
      coefficients: { '6ème': 1, '5ème': 1, '4ème': 1, '3ème': 1, 'Seconde': 1, 'Première': 1, 'Terminale': 1 },
      volumeHoraire: { '6ème': '1h', '5ème': '1h', '4ème': '1h', '3ème': '1h', 'Seconde': '1h', 'Première': '1h', 'Terminale': '1h' }
    },
    'musique': {
      coefficients: { '6ème': 1, '5ème': 1, '4ème': 1, '3ème': 1, 'Seconde': 1, 'Première': 1, 'Terminale': 1 },
      volumeHoraire: { '6ème': '1h', '5ème': '1h', '4ème': '1h', '3ème': '1h', 'Seconde': '1h', 'Première': '1h', 'Terminale': '1h' }
    },
    'education-civique': {
      coefficients: { '6ème': 1, '5ème': 1, '4ème': 1, '3ème': 1, 'Seconde': 1, 'Première': 1, 'Terminale': 1 },
      volumeHoraire: { '6ème': '1h', '5ème': '1h', '4ème': '1h', '3ème': '1h', 'Seconde': '1h', 'Première': '1h', 'Terminale': '1h' }
    },
    'economie-familiale': {
      coefficients: { '6ème': 1, '5ème': 1, '4ème': 1, '3ème': 1, 'Seconde': 0, 'Première': 0, 'Terminale': 0 },
      volumeHoraire: { '6ème': '1h', '5ème': '1h', '4ème': '1h', '3ème': '1h', 'Seconde': '0h', 'Première': '0h', 'Terminale': '0h' }
    }
  };
  
  const db = firebase.firestore();
  const batch = db.batch();
  let count = 0;
  
  for (const [disciplineId, config] of Object.entries(CONFIGS_PAR_DISCIPLINE)) {
    const ref = db.collection('disciplines').doc(disciplineId);
    
    batch.update(ref, {
      coefficients: config.coefficients,
      volumeHoraire: config.volumeHoraire,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    count++;
    console.log(`✅ ${count}. ${disciplineId} - coefficients et volumes horaires ajoutés`);
  }
  
  try {
    await batch.commit();
    console.log(`\n🎉 Migration terminée ! ${count} disciplines mises à jour.`);
    console.log('\n📊 Vérification :');
    console.log('Exemple - Mathématiques :');
    
    const mathsDoc = await db.collection('disciplines').doc('maths').get();
    const mathsData = mathsDoc.data();
    console.log('  Coefficient 6ème:', mathsData.coefficients['6ème']);
    console.log('  Volume horaire 6ème:', mathsData.volumeHoraire['6ème']);
    console.log('  Coefficient Terminale:', mathsData.coefficients['Terminale']);
    console.log('  Volume horaire Terminale:', mathsData.volumeHoraire['Terminale']);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    return false;
  }
}

// Rendre la fonction accessible
window.migrerDisciplines = migrerDisciplines;

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🔄 MIGRATION DISCIPLINES DISPONIBLE                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Cette migration ajoute les coefficients et volumes       ║
║  horaires aux 21 disciplines existantes.                  ║
║                                                           ║
║  Pour lancer la migration :                               ║
║                                                           ║
║  1. Ouvrez la console (F12)                               ║
║  2. Connectez-vous en tant qu'admin                       ║
║  3. Tapez : await migrerDisciplines()                     ║
║  4. Appuyez sur Entrée                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
