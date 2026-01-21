async function initDisciplines() {
  console.log('🚀 Initialisation des 21 disciplines...');
  
  const DISCIPLINES = [
    // LANGUES
    { id: 'francais', nom: 'Français', categorie: 'Langues', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 0 },
    { id: 'anglais', nom: 'Anglais', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 1 },
    { id: 'allemand', nom: 'Allemand', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 2 },
    { id: 'arabe', nom: 'Arabe', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 3 },
    { id: 'espagnol', nom: 'Espagnol', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 4 },
    { id: 'italien', nom: 'Italien', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 5 },
    { id: 'grec', nom: 'Grec', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 6 },
    { id: 'latin', nom: 'Latin', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 7 },
    { id: 'portugais', nom: 'Portugais', categorie: 'Langues', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 8 },
    
    // SCIENCES
    { id: 'maths', nom: 'Mathématiques', categorie: 'Sciences', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 9 },
    { id: 'pc', nom: 'Physique-Chimie', categorie: 'Sciences', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 10 },
    { id: 'svt', nom: 'SVT', categorie: 'Sciences', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 11 },
    { id: 'mecanique', nom: 'Mécanique', categorie: 'Sciences', isOptionnelle: true, niveauxCibles: ['Seconde', 'Première', 'Terminale'], ordre: 12 },
    
    // SCIENCES HUMAINES
    { id: 'histo-geo', nom: 'Histoire-Géographie', categorie: 'Sciences humaines & sociales', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 13 },
    { id: 'philosophie', nom: 'Philosophie', categorie: 'Sciences humaines & sociales', isOptionnelle: false, niveauxCibles: ['Seconde', 'Première', 'Terminale'], ordre: 14 },
    
    // GESTION
    { id: 'eco-gestion', nom: 'Économie/Gestion', categorie: 'Gestion', isOptionnelle: true, niveauxCibles: ['Seconde', 'Première', 'Terminale'], ordre: 15 },
    
    // SPORTS
    { id: 'eps', nom: 'Éducation physique et sportive', categorie: 'Sports', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 16 },
    
    // ÉVEIL
    { id: 'arts-plastiques', nom: 'Arts plastiques', categorie: 'Éveil', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 17 },
    { id: 'musique', nom: 'Musique', categorie: 'Éveil', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 18 },
    { id: 'education-civique', nom: 'Éducation civique', categorie: 'Éveil', isOptionnelle: false, niveauxCibles: ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'], ordre: 19 },
    { id: 'economie-familiale', nom: 'Économie familiale', categorie: 'Éveil', isOptionnelle: true, niveauxCibles: ['6ème', '5ème', '4ème', '3ème'], ordre: 20 }
  ];

  const db = firebase.firestore();
  const batch = db.batch();
  
  DISCIPLINES.forEach(disc => {
    const ref = db.collection('disciplines').doc(disc.id);
    batch.set(ref, {
      ...disc,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  
  try {
    await batch.commit();
    console.log('✅ 21 disciplines initialisées !');
    console.log('📊 Langues: 9 | Sciences: 4 | Humaines: 2 | Gestion: 1 | Sports: 1 | Éveil: 4');
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return false;
  }
}

window.initDisciplines = initDisciplines;
console.log('💡 Pour initialiser : initDisciplines()');
