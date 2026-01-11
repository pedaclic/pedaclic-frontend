// Code du composant Générateur
const { useState } = React;

const GenerateurContenus = () => {
  const [formData, setFormData] = useState({
    niveau: '',
    matiere: '',
    typeContenu: '',
    duree: '',
    avecExercices: 'oui',
    difficulte: 'moyen',
    format: 'pdf',
    titre: ''
  });
  
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const userName = "Kadou - Professeur";

  const niveaux = ['Primaire', 'Collège', 'Lycée', 'Université'];
  const matieres = ['Français', 'Mathématiques', 'Histoire-Géographie', 'Sciences', 'Philosophie'];
  const typesContenu = ['Cours complet', 'Exercices', 'Corrigés', 'Évaluation', 'Fiche de révision'];
  const durees = ['1 page', '2-3 pages', '4-5 pages', '6-10 pages', 'Plus de 10 pages'];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const genererContenu = async () => {
    if (!formData.niveau || !formData.matiere || !formData.typeContenu) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setGenerating(true);
    
    const prompt = `Tu es un enseignant expert en ${formData.matiere}. Crée un ${formData.typeContenu.toLowerCase()} de niveau ${formData.niveau} sur le sujet "${formData.titre || 'à définir selon le programme'}".

Spécifications :
- Niveau : ${formData.niveau}
- Matière : ${formData.matiere}
- Type : ${formData.typeContenu}
- Volume : ${formData.duree}
- Inclure des exercices : ${formData.avecExercices}
- Niveau de difficulté : ${formData.difficulte}

Le contenu doit être structuré, pédagogique et adapté au niveau des élèves.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [
            { role: "user", content: prompt }
          ],
        })
      });

      const data = await response.json();
      const content = data.content[0].text;
      
      setGeneratedContent(content);
      setShowPreview(true);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la génération du contenu');
    } finally {
      setGenerating(false);
    }
  };

  const exporterPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // En-tête
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('PedaClic', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text("L'école en un clic", pageWidth / 2, 22, { align: 'center' });
    
    // Contenu
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    const lines = doc.splitTextToSize(generatedContent, pageWidth - 40);
    let y = 40;
    
    lines.forEach(line => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 7;
    });
    
    doc.save(`pedaclic_${formData.typeContenu}_${formData.matiere}.pdf`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>Générateur de Contenus Pédagogiques</h1>
        <p style={{ color: '#7f8c8d' }}>Module Premium PedaClic</p>
      </div>

      <div style={{ background: 'white', borderRadius: '15px', padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Titre du contenu</label>
          <input
            type="text"
            name="titre"
            value={formData.titre}
            onChange={handleChange}
            placeholder="Ex: Les figures de style"
            style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Niveau</label>
            <select name="niveau" value={formData.niveau} onChange={handleChange} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
              <option value="">Sélectionner</option>
              {niveaux.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Matière</label>
            <select name="matiere" value={formData.matiere} onChange={handleChange} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
              <option value="">Sélectionner</option>
              {matieres.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={genererContenu}
          disabled={generating}
          style={{
            width: '100%',
            background: generating ? '#95a5a6' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '15px',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: generating ? 'not-allowed' : 'pointer',
            marginTop: '20px'
          }}
        >
          {generating ? 'Génération en cours...' : 'Générer le contenu'}
        </button>

        {showPreview && (
          <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3>Prévisualisation</h3>
              <button onClick={exporterPDF} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
                Télécharger PDF
              </button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
              {generatedContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ReactDOM.render(<GenerateurContenus />, document.getElementById('root'));
