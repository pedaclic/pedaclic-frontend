var AdminPanel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // pedaclic-admin-panel.tsx
  var pedaclic_admin_panel_exports = {};
  __export(pedaclic_admin_panel_exports, {
    default: () => pedaclic_admin_panel_default
  });
  var import_react2 = __require("react");
  var import_lucide_react2 = __require("lucide-react");

  // PlanificationContenus.tsx
  var import_react = __require("react");
  var import_lucide_react = __require("lucide-react");
  var import_recharts = __require("recharts");
  var import_jsx_runtime = __require("react/jsx-runtime");
  var NIVEAUX = ["6\xE8me", "5\xE8me", "4\xE8me", "3\xE8me", "Seconde", "Premi\xE8re", "Terminale"];
  var TRIMESTRES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];
  var DISCIPLINES = [
    "Fran\xE7ais",
    "Math\xE9matiques",
    "Histoire-G\xE9o",
    "SVT",
    "Physique-Chimie",
    "Anglais",
    "EPS",
    "Arts",
    "Technologie"
  ];
  var COULEURS = ["#6676ea", "#4a7ba7", "#00a896", "#f4a261", "#e76f51", "#e63946", "#8e44ad", "#2e5077", "#6fa8dc"];
  var PlanificationContenus = () => {
    const [contenus, setContenus] = (0, import_react.useState)({});
    const [niveauActif, setNiveauActif] = (0, import_react.useState)("6\xE8me");
    const [trimestreActif, setTrimestreActif] = (0, import_react.useState)("Trimestre 1");
    const [disciplineActive, setDisciplineActive] = (0, import_react.useState)("Fran\xE7ais");
    const [vueActive, setVueActive] = (0, import_react.useState)("planification");
    (0, import_react.useEffect)(() => {
      const initialData = {};
      NIVEAUX.forEach((niveau) => {
        initialData[niveau] = {};
        TRIMESTRES.forEach((trimestre) => {
          initialData[niveau][trimestre] = {};
          DISCIPLINES.forEach((discipline) => {
            initialData[niveau][trimestre][discipline] = {
              themes: "",
              objectifs: "",
              competences: "",
              evaluations: "",
              ressources: "",
              statut: "non-commence",
              progression: 0
            };
          });
        });
      });
      setContenus(initialData);
    }, []);
    const updateContenu = (niveau, trimestre, discipline, champ, valeur) => {
      setContenus((prev) => ({
        ...prev,
        [niveau]: {
          ...prev[niveau],
          [trimestre]: {
            ...prev[niveau][trimestre],
            [discipline]: {
              ...prev[niveau][trimestre][discipline],
              [champ]: valeur
            }
          }
        }
      }));
    };
    const calculerStatistiques = () => {
      let total = 0;
      let termines = 0;
      let enCours = 0;
      let nonCommences = 0;
      Object.values(contenus).forEach((niveau) => {
        Object.values(niveau).forEach((trimestre) => {
          Object.values(trimestre).forEach((contenu) => {
            total++;
            if (contenu.statut === "termine") termines++;
            else if (contenu.statut === "en-cours") enCours++;
            else nonCommences++;
          });
        });
      });
      return {
        total,
        termines,
        enCours,
        nonCommences,
        tauxCompletion: total > 0 ? Math.round(termines / total * 100) : 0
      };
    };
    const prepareDataNiveaux = () => {
      return NIVEAUX.map((niveau) => {
        let termine = 0;
        let enCours = 0;
        let nonCommence = 0;
        if (contenus[niveau]) {
          Object.values(contenus[niveau]).forEach((trimestre) => {
            Object.values(trimestre).forEach((contenu) => {
              if (contenu.statut === "termine") termine++;
              else if (contenu.statut === "en-cours") enCours++;
              else nonCommence++;
            });
          });
        }
        return {
          niveau,
          "Termin\xE9": termine,
          "En cours": enCours,
          "Non commenc\xE9": nonCommence
        };
      });
    };
    const prepareDataDisciplines = () => {
      return DISCIPLINES.map((discipline) => {
        let count = 0;
        Object.values(contenus).forEach((niveau) => {
          Object.values(niveau).forEach((trimestre) => {
            if (trimestre[discipline] && trimestre[discipline].statut === "termine") {
              count++;
            }
          });
        });
        return { name: discipline, value: count };
      });
    };
    const prepareDataTrimestres = () => {
      return TRIMESTRES.map((trimestre) => {
        let total = 0;
        let termine = 0;
        Object.values(contenus).forEach((niveau) => {
          if (niveau[trimestre]) {
            Object.values(niveau[trimestre]).forEach((contenu) => {
              total++;
              if (contenu.statut === "termine") termine++;
            });
          }
        });
        return {
          trimestre,
          progression: total > 0 ? Math.round(termine / total * 100) : 0
        };
      });
    };
    const exporterVersExcel = () => {
      let csv = "Niveau,Trimestre,Discipline,Th\xE8mes,Objectifs,Comp\xE9tences,\xC9valuations,Ressources,Statut,Progression (%)\n";
      NIVEAUX.forEach((niveau) => {
        TRIMESTRES.forEach((trimestre) => {
          DISCIPLINES.forEach((discipline) => {
            const contenu = contenus[niveau]?.[trimestre]?.[discipline] || {};
            const row = [
              niveau,
              trimestre,
              discipline,
              `"${(contenu.themes || "").replace(/"/g, '""')}"`,
              `"${(contenu.objectifs || "").replace(/"/g, '""')}"`,
              `"${(contenu.competences || "").replace(/"/g, '""')}"`,
              `"${(contenu.evaluations || "").replace(/"/g, '""')}"`,
              `"${(contenu.ressources || "").replace(/"/g, '""')}"`,
              contenu.statut === "termine" ? "Termin\xE9" : contenu.statut === "en-cours" ? "En cours" : "Non commenc\xE9",
              contenu.progression || 0
            ];
            csv += row.join(",") + "\n";
          });
        });
      });
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `planification-contenus-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    };
    const stats = calculerStatistiques();
    const contenuActif = contenus[niveauActif]?.[trimestreActif]?.[disciplineActive] || {
      themes: "",
      objectifs: "",
      competences: "",
      evaluations: "",
      ressources: "",
      statut: "non-commence",
      progression: 0
    };
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: "white", borderRadius: "15px", padding: "30px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: "30px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.BookOpen, { size: 32, style: { color: "#6676ea" } }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { margin: 0, color: "#2c3e50", fontSize: "24px", fontWeight: "bold" }, children: "Planification de Contenus P\xE9dagogiques" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "5px 0 0 0", color: "#7f8c8d", fontSize: "14px" }, children: "G\xE9rez vos programmes de la 6\xE8me \xE0 la Terminale" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.CheckCircle2, { size: 20 }), titre: "Taux de compl\xE9tion", valeur: `${stats.tauxCompletion}%`, couleur: "#00a896" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Clock, { size: 20 }), titre: "En cours", valeur: stats.enCours, couleur: "#f4a261" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.TrendingUp, { size: 20 }), titre: "Termin\xE9s", valeur: stats.termines, couleur: "#6676ea" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.Calendar, { size: 20 }), titre: "Total", valeur: stats.total, couleur: "#8e44ad" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "10px", marginBottom: "25px", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            onClick: () => setVueActive("planification"),
            style: {
              padding: "10px 20px",
              background: vueActive === "planification" ? "#6676ea" : "#f0f0f0",
              color: vueActive === "planification" ? "white" : "#2c3e50",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.BookOpen, { size: 18 }),
              "Planification"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            onClick: () => setVueActive("tableauDeBord"),
            style: {
              padding: "10px 20px",
              background: vueActive === "tableauDeBord" ? "#6676ea" : "#f0f0f0",
              color: vueActive === "tableauDeBord" ? "white" : "#2c3e50",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.BarChart3, { size: 18 }),
              "Tableau de bord"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { flex: 1 } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            onClick: exporterVersExcel,
            style: {
              padding: "10px 20px",
              background: "#00a896",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.FileSpreadsheet, { size: 18 }),
              "Export Excel"
            ]
          }
        )
      ] }),
      vueActive === "planification" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        VuePlanification,
        {
          niveauActif,
          setNiveauActif,
          trimestreActif,
          setTrimestreActif,
          disciplineActive,
          setDisciplineActive,
          contenuActif,
          updateContenu
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        VueTableauDeBord,
        {
          prepareDataNiveaux,
          prepareDataDisciplines,
          prepareDataTrimestres
        }
      )
    ] });
  };
  var StatCard = ({ icon, titre, valeur, couleur }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    background: "#f8f9fa",
    padding: "20px",
    borderRadius: "10px",
    border: "2px solid #e0e0e0"
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: couleur }, children: icon }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "12px", color: "#7f8c8d", marginBottom: "5px" }, children: titre }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "24px", fontWeight: "bold", color: couleur }, children: valeur })
    ] })
  ] }) });
  var VuePlanification = ({ niveauActif, setNiveauActif, trimestreActif, setTrimestreActif, disciplineActive, setDisciplineActive, contenuActif, updateContenu }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "15px", marginBottom: "25px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#2c3e50" }, children: "Niveau scolaire" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            value: niveauActif,
            onChange: (e) => setNiveauActif(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              border: "2px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer"
            },
            children: NIVEAUX.map((niveau) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: niveau, children: niveau }, niveau))
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#2c3e50" }, children: "Trimestre" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            value: trimestreActif,
            onChange: (e) => setTrimestreActif(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              border: "2px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer"
            },
            children: TRIMESTRES.map((trimestre) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: trimestre, children: trimestre }, trimestre))
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#2c3e50" }, children: "Discipline" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            value: disciplineActive,
            onChange: (e) => setDisciplineActive(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              border: "2px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer"
            },
            children: DISCIPLINES.map((discipline) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: discipline, children: discipline }, discipline))
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: "#f8f9fa", padding: "25px", borderRadius: "10px", border: "2px solid #e0e0e0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { style: { margin: "0 0 20px 0", fontSize: "18px", fontWeight: "bold", color: "#6676ea" }, children: [
        niveauActif,
        " - ",
        trimestreActif,
        " - ",
        disciplineActive
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gap: "20px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ChampTexte,
          {
            label: "Th\xE8mes et chapitres",
            placeholder: "Ex: L'accord du participe pass\xE9, Les figures de style...",
            value: contenuActif.themes,
            onChange: (val) => updateContenu(niveauActif, trimestreActif, disciplineActive, "themes", val)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ChampTexte,
          {
            label: "Objectifs d'apprentissage",
            placeholder: "Ex: Ma\xEEtriser les r\xE8gles d'accord, Identifier les m\xE9taphores...",
            value: contenuActif.objectifs,
            onChange: (val) => updateContenu(niveauActif, trimestreActif, disciplineActive, "objectifs", val),
            rows: 3
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ChampTexte,
          {
            label: "Comp\xE9tences vis\xE9es",
            placeholder: "Ex: Analyse critique, R\xE9daction argument\xE9e...",
            value: contenuActif.competences,
            onChange: (val) => updateContenu(niveauActif, trimestreActif, disciplineActive, "competences", val),
            rows: 3
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ChampTexte,
          {
            label: "\xC9valuations pr\xE9vues",
            placeholder: "Ex: Contr\xF4le continu, Dissertation finale...",
            value: contenuActif.evaluations,
            onChange: (val) => updateContenu(niveauActif, trimestreActif, disciplineActive, "evaluations", val)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ChampTexte,
          {
            label: "Ressources p\xE9dagogiques",
            placeholder: "Ex: Manuel Hatier p.45-78, Vid\xE9o Lumni, Exercices PedaClic...",
            value: contenuActif.ressources,
            onChange: (val) => updateContenu(niveauActif, trimestreActif, disciplineActive, "ressources", val),
            rows: 2
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#2c3e50" }, children: "Statut" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "select",
              {
                value: contenuActif.statut,
                onChange: (e) => updateContenu(niveauActif, trimestreActif, disciplineActive, "statut", e.target.value),
                style: {
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "non-commence", children: "Non commenc\xE9" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "en-cours", children: "En cours" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "termine", children: "Termin\xE9" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#2c3e50" }, children: "Progression (%)" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                type: "number",
                min: "0",
                max: "100",
                value: contenuActif.progression,
                onChange: (e) => updateContenu(niveauActif, trimestreActif, disciplineActive, "progression", parseInt(e.target.value) || 0),
                style: {
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  fontSize: "14px"
                }
              }
            )
          ] })
        ] })
      ] })
    ] })
  ] });
  var ChampTexte = ({ label, placeholder, value, onChange, rows = 1 }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#2c3e50" }, children: label }),
    rows > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "textarea",
      {
        placeholder,
        value,
        onChange: (e) => onChange(e.target.value),
        rows,
        style: {
          width: "100%",
          padding: "10px",
          border: "2px solid #e0e0e0",
          borderRadius: "8px",
          fontSize: "14px",
          resize: "vertical",
          fontFamily: "inherit"
        }
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        type: "text",
        placeholder,
        value,
        onChange: (e) => onChange(e.target.value),
        style: {
          width: "100%",
          padding: "10px",
          border: "2px solid #e0e0e0",
          borderRadius: "8px",
          fontSize: "14px"
        }
      }
    )
  ] });
  var VueTableauDeBord = ({ prepareDataNiveaux, prepareDataDisciplines, prepareDataTrimestres }) => {
    const dataNiveaux = prepareDataNiveaux();
    const dataDisciplines = prepareDataDisciplines();
    const dataTrimestres = prepareDataTrimestres();
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 25px 0", fontSize: "20px", fontWeight: "bold", color: "#2c3e50" }, children: "Visualisations et Statistiques" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gap: "25px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: "#f8f9fa", padding: "25px", borderRadius: "10px", border: "2px solid #e0e0e0" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { style: { margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600", color: "#2c3e50" }, children: "Progression par niveau" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.ResponsiveContainer, { width: "100%", height: 350, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_recharts.BarChart, { data: dataNiveaux, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.CartesianGrid, { strokeDasharray: "3 3", stroke: "#e0e0e0" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.XAxis, { dataKey: "niveau" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.YAxis, {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Tooltip, {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Legend, {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Bar, { dataKey: "Termin\xE9", fill: "#00a896" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Bar, { dataKey: "En cours", fill: "#f4a261" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Bar, { dataKey: "Non commenc\xE9", fill: "#95a5a6" })
          ] }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "25px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: "#f8f9fa", padding: "25px", borderRadius: "10px", border: "2px solid #e0e0e0" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { style: { margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600", color: "#2c3e50" }, children: "Contenus termin\xE9s par discipline" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.ResponsiveContainer, { width: "100%", height: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_recharts.PieChart, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                import_recharts.Pie,
                {
                  data: dataDisciplines,
                  cx: "50%",
                  cy: "50%",
                  labelLine: false,
                  label: (entry) => entry.name,
                  outerRadius: 100,
                  fill: "#8884d8",
                  dataKey: "value",
                  children: dataDisciplines.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Cell, { fill: COULEURS[index % COULEURS.length] }, `cell-${index}`))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Tooltip, {})
            ] }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: "#f8f9fa", padding: "25px", borderRadius: "10px", border: "2px solid #e0e0e0" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { style: { margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600", color: "#2c3e50" }, children: "Taux de compl\xE9tion par trimestre" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.ResponsiveContainer, { width: "100%", height: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_recharts.LineChart, { data: dataTrimestres, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.CartesianGrid, { strokeDasharray: "3 3", stroke: "#e0e0e0" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.XAxis, { dataKey: "trimestre" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.YAxis, {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Tooltip, {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_recharts.Line, { type: "monotone", dataKey: "progression", stroke: "#6676ea", strokeWidth: 3, dot: { fill: "#6676ea", r: 6 } })
            ] }) })
          ] })
        ] })
      ] })
    ] });
  };
  var PlanificationContenus_default = PlanificationContenus;

  // pedaclic-admin-panel.tsx
  var import_jsx_runtime2 = __require("react/jsx-runtime");
  var AdminPanel = () => {
    const [activeTab, setActiveTab] = (0, import_react2.useState)("niveaux");
    const [niveaux, setNiveaux] = (0, import_react2.useState)([]);
    const [classes, setClasses] = (0, import_react2.useState)([]);
    const [matieres, setMatieres] = (0, import_react2.useState)([]);
    const [showAddNiveau, setShowAddNiveau] = (0, import_react2.useState)(false);
    const [showAddClasse, setShowAddClasse] = (0, import_react2.useState)(false);
    const [showAddMatiere, setShowAddMatiere] = (0, import_react2.useState)(false);
    const [editingItem, setEditingItem] = (0, import_react2.useState)(null);
    const [newNiveau, setNewNiveau] = (0, import_react2.useState)("");
    const [newClasse, setNewClasse] = (0, import_react2.useState)({ nom: "", niveauId: "" });
    const [newMatiere, setNewMatiere] = (0, import_react2.useState)({ nom: "", classeIds: [] });
    (0, import_react2.useEffect)(() => {
      if (typeof firebase !== "undefined") {
        loadNiveaux();
        loadClasses();
        loadMatieres();
      }
    }, []);
    const loadNiveaux = async () => {
      try {
        const db = firebase.firestore();
        const snapshot = await db.collection("config_niveaux").orderBy("ordre").get();
        setNiveaux(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erreur chargement niveaux:", error);
      }
    };
    const loadClasses = async () => {
      try {
        const db = firebase.firestore();
        const snapshot = await db.collection("config_classes").orderBy("ordre").get();
        setClasses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erreur chargement classes:", error);
      }
    };
    const loadMatieres = async () => {
      try {
        const db = firebase.firestore();
        const snapshot = await db.collection("config_matieres").get();
        setMatieres(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erreur chargement mati\xE8res:", error);
      }
    };
    const ajouterNiveau = async () => {
      if (!newNiveau.trim()) return;
      try {
        const db = firebase.firestore();
        await db.collection("config_niveaux").add({
          nom: newNiveau,
          ordre: niveaux.length + 1,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setNewNiveau("");
        setShowAddNiveau(false);
        loadNiveaux();
      } catch (error) {
        console.error("Erreur ajout niveau:", error);
        alert("Erreur lors de l'ajout du niveau");
      }
    };
    const modifierNiveau = async (id, nouveauNom) => {
      try {
        const db = firebase.firestore();
        await db.collection("config_niveaux").doc(id).update({ nom: nouveauNom });
        setEditingItem(null);
        loadNiveaux();
      } catch (error) {
        console.error("Erreur modification niveau:", error);
        alert("Erreur lors de la modification");
      }
    };
    const supprimerNiveau = async (id) => {
      if (!confirm("Supprimer ce niveau ? Les classes associ\xE9es seront aussi supprim\xE9es.")) return;
      try {
        const db = firebase.firestore();
        await db.collection("config_niveaux").doc(id).delete();
        const classesSnap = await db.collection("config_classes").where("niveauId", "==", id).get();
        classesSnap.docs.forEach((doc) => doc.ref.delete());
        loadNiveaux();
        loadClasses();
      } catch (error) {
        console.error("Erreur suppression niveau:", error);
        alert("Erreur lors de la suppression");
      }
    };
    const ajouterClasse = async () => {
      if (!newClasse.nom.trim() || !newClasse.niveauId) {
        alert("Veuillez remplir tous les champs");
        return;
      }
      try {
        const db = firebase.firestore();
        const classesInNiveau = classes.filter((c) => c.niveauId === newClasse.niveauId);
        await db.collection("config_classes").add({
          nom: newClasse.nom,
          niveauId: newClasse.niveauId,
          ordre: classesInNiveau.length + 1,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setNewClasse({ nom: "", niveauId: "" });
        setShowAddClasse(false);
        loadClasses();
      } catch (error) {
        console.error("Erreur ajout classe:", error);
        alert("Erreur lors de l'ajout");
      }
    };
    const modifierClasse = async (id, nouveauNom) => {
      try {
        const db = firebase.firestore();
        await db.collection("config_classes").doc(id).update({ nom: nouveauNom });
        setEditingItem(null);
        loadClasses();
      } catch (error) {
        console.error("Erreur modification classe:", error);
        alert("Erreur lors de la modification");
      }
    };
    const supprimerClasse = async (id) => {
      if (!confirm("Supprimer cette classe ?")) return;
      try {
        const db = firebase.firestore();
        await db.collection("config_classes").doc(id).delete();
        const matieresSnap = await db.collection("config_matieres").get();
        matieresSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.classeIds && data.classeIds.includes(id)) {
            const newClasseIds = data.classeIds.filter((cId) => cId !== id);
            doc.ref.update({ classeIds: newClasseIds });
          }
        });
        loadClasses();
        loadMatieres();
      } catch (error) {
        console.error("Erreur suppression classe:", error);
        alert("Erreur lors de la suppression");
      }
    };
    const ajouterMatiere = async () => {
      if (!newMatiere.nom.trim() || newMatiere.classeIds.length === 0) {
        alert("Veuillez remplir tous les champs et s\xE9lectionner au moins une classe");
        return;
      }
      try {
        const db = firebase.firestore();
        await db.collection("config_matieres").add({
          nom: newMatiere.nom,
          classeIds: newMatiere.classeIds,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setNewMatiere({ nom: "", classeIds: [] });
        setShowAddMatiere(false);
        loadMatieres();
      } catch (error) {
        console.error("Erreur ajout mati\xE8re:", error);
        alert("Erreur lors de l'ajout");
      }
    };
    const supprimerMatiere = async (id) => {
      if (!confirm("Supprimer cette mati\xE8re ?")) return;
      try {
        const db = firebase.firestore();
        await db.collection("config_matieres").doc(id).delete();
        loadMatieres();
      } catch (error) {
        console.error("Erreur suppression mati\xE8re:", error);
        alert("Erreur lors de la suppression");
      }
    };
    const toggleClasseForMatiere = (classeId) => {
      setNewMatiere((prev) => ({
        ...prev,
        classeIds: prev.classeIds.includes(classeId) ? prev.classeIds.filter((id) => id !== classeId) : [...prev.classeIds, classeId]
      }));
    };
    const getClassesByNiveau = (niveauId) => {
      return classes.filter((c) => c.niveauId === niveauId);
    };
    const styles = {
      container: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px"
      },
      header: {
        background: "white",
        borderRadius: "15px",
        padding: "30px",
        marginBottom: "30px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      },
      tabButton: (isActive) => ({
        padding: "15px 30px",
        background: isActive ? "white" : "rgba(255,255,255,0.3)",
        color: isActive ? "#667eea" : "white",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        transition: "all 0.3s ease"
      }),
      contentCard: {
        background: "white",
        borderRadius: "15px",
        padding: "30px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      },
      addButton: {
        background: "#667eea",
        color: "white",
        border: "none",
        padding: "10px 15px",
        borderRadius: "8px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontWeight: "bold",
        transition: "all 0.3s ease"
      },
      modal: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1e3
      },
      modalContent: {
        background: "white",
        padding: "30px",
        borderRadius: "15px",
        width: "90%",
        maxWidth: "500px"
      }
    };
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles.container, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles.header, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "15px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Settings, { size: 40, color: "#667eea" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { style: { margin: 0, color: "#2c3e50", fontSize: "28px" }, children: "Panneau d'Administration" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { color: "#7f8c8d", margin: "5px 0 0 0", fontSize: "15px" }, children: "Configuration de la structure p\xE9dagogique" })
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            onClick: () => setActiveTab("niveaux"),
            style: styles.tabButton(activeTab === "niveaux"),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.GraduationCap, { size: 20 }),
              " Niveaux"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            onClick: () => setActiveTab("classes"),
            style: styles.tabButton(activeTab === "classes"),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.BookOpen, { size: 20 }),
              " Classes"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            onClick: () => setActiveTab("matieres"),
            style: styles.tabButton(activeTab === "matieres"),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Book, { size: 20 }),
              " Mati\xE8res"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            onClick: () => setActiveTab("planification"),
            style: styles.tabButton(activeTab === "planification"),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Calendar, { size: 20 }),
              " Planification"
            ]
          }
        )
      ] }),
      activeTab === "niveaux" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles.contentCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: 0, fontSize: "22px", color: "#2c3e50" }, children: "Niveaux d'enseignement" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { onClick: () => setShowAddNiveau(true), style: styles.addButton, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Plus, { size: 18 }),
            " Ajouter un niveau"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "grid", gap: "15px" }, children: niveaux.map((niveau) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            style: {
              border: "2px solid #e0e0e0",
              borderRadius: "10px",
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fafafa",
              transition: "all 0.3s ease"
            },
            children: [
              editingItem?.id === niveau.id ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "input",
                {
                  type: "text",
                  defaultValue: niveau.nom,
                  onBlur: (e) => modifierNiveau(niveau.id, e.target.value),
                  autoFocus: true,
                  style: {
                    flex: 1,
                    padding: "10px",
                    border: "2px solid #667eea",
                    borderRadius: "5px",
                    fontSize: "16px",
                    fontWeight: "bold"
                  }
                }
              ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: "20px", fontWeight: "bold", color: "#2c3e50" }, children: niveau.nom }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { fontSize: "14px", color: "#7f8c8d", marginTop: "5px" }, children: [
                  getClassesByNiveau(niveau.id).length,
                  " classe(s)"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: "8px" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    onClick: () => setEditingItem(niveau),
                    style: {
                      background: "#3498db",
                      color: "white",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      transition: "all 0.3s ease"
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Edit2, { size: 16 })
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    onClick: () => supprimerNiveau(niveau.id),
                    style: {
                      background: "#e74c3c",
                      color: "white",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      transition: "all 0.3s ease"
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 16 })
                  }
                )
              ] })
            ]
          },
          niveau.id
        )) })
      ] }),
      activeTab === "classes" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles.contentCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: 0, fontSize: "22px", color: "#2c3e50" }, children: "Classes par niveau" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { onClick: () => setShowAddClasse(true), style: styles.addButton, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Plus, { size: 18 }),
            " Ajouter une classe"
          ] })
        ] }),
        niveaux.map((niveau) => {
          const classesNiveau = getClassesByNiveau(niveau.id);
          if (classesNiveau.length === 0) return null;
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "30px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { style: {
              color: "#667eea",
              marginBottom: "15px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "18px"
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.GraduationCap, { size: 24 }),
              " ",
              niveau.nom
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "15px"
            }, children: classesNiveau.map((classe) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                style: {
                  border: "2px solid #e0e0e0",
                  borderRadius: "10px",
                  padding: "15px",
                  background: "#fafafa",
                  transition: "all 0.3s ease"
                },
                children: [
                  editingItem?.id === classe.id ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "input",
                    {
                      type: "text",
                      defaultValue: classe.nom,
                      onBlur: (e) => modifierClasse(classe.id, e.target.value),
                      autoFocus: true,
                      style: {
                        width: "100%",
                        padding: "8px",
                        border: "2px solid #667eea",
                        borderRadius: "5px",
                        fontWeight: "bold"
                      }
                    }
                  ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#2c3e50",
                    marginBottom: "10px"
                  }, children: classe.nom }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: "5px", marginTop: "10px" }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "button",
                      {
                        onClick: () => setEditingItem(classe),
                        style: {
                          flex: 1,
                          background: "#3498db",
                          color: "white",
                          border: "none",
                          padding: "6px",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.3s ease"
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Edit2, { size: 14 })
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "button",
                      {
                        onClick: () => supprimerClasse(classe.id),
                        style: {
                          flex: 1,
                          background: "#e74c3c",
                          color: "white",
                          border: "none",
                          padding: "6px",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.3s ease"
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 14 })
                      }
                    )
                  ] })
                ]
              },
              classe.id
            )) })
          ] }, niveau.id);
        })
      ] }),
      activeTab === "matieres" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles.contentCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: 0, fontSize: "22px", color: "#2c3e50" }, children: "Mati\xE8res" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { onClick: () => setShowAddMatiere(true), style: styles.addButton, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Plus, { size: 18 }),
            " Ajouter une mati\xE8re"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "grid", gap: "15px" }, children: matieres.map((matiere) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              border: "2px solid #e0e0e0",
              borderRadius: "10px",
              padding: "20px",
              background: "#fafafa",
              transition: "all 0.3s ease"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: "15px"
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: 1 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#2c3e50",
                  marginBottom: "10px"
                }, children: matiere.nom }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { fontSize: "14px", color: "#7f8c8d" }, children: [
                  "Disponible pour : ",
                  matiere.classeIds.map((cId) => {
                    const classe = classes.find((c) => c.id === cId);
                    return classe ? classe.nom : "";
                  }).filter(Boolean).join(", ")
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  onClick: () => supprimerMatiere(matiere.id),
                  style: {
                    background: "#e74c3c",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 16 })
                }
              )
            ] })
          },
          matiere.id
        )) })
      ] }),
      activeTab === "planification" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        background: "white",
        borderRadius: "15px",
        padding: "0",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        overflow: "hidden"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PlanificationContenus_default, {}) }),
      showAddNiveau && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles.modal, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles.modalContent, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { marginTop: 0, color: "#2c3e50" }, children: "Ajouter un niveau" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: {
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
            color: "#2c3e50"
          }, children: "Nom du niveau" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "text",
              value: newNiveau,
              onChange: (e) => setNewNiveau(e.target.value),
              placeholder: "Ex: Primaire, Coll\xE8ge, Lyc\xE9e",
              style: {
                width: "100%",
                padding: "10px",
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "14px"
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: () => {
                setShowAddNiveau(false);
                setNewNiveau("");
              },
              style: {
                padding: "10px 20px",
                background: "#95a5a6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              },
              children: "Annuler"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: ajouterNiveau,
              style: {
                padding: "10px 20px",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              },
              children: "Ajouter"
            }
          )
        ] })
      ] }) }),
      showAddClasse && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles.modal, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles.modalContent, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { marginTop: 0, color: "#2c3e50" }, children: "Ajouter une classe" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "15px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: {
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
            color: "#2c3e50"
          }, children: "Niveau" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "select",
            {
              value: newClasse.niveauId,
              onChange: (e) => setNewClasse({ ...newClasse, niveauId: e.target.value }),
              style: {
                width: "100%",
                padding: "10px",
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "S\xE9lectionner un niveau" }),
                niveaux.map((n) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: n.id, children: n.nom }, n.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: {
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
            color: "#2c3e50"
          }, children: "Nom de la classe" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "text",
              value: newClasse.nom,
              onChange: (e) => setNewClasse({ ...newClasse, nom: e.target.value }),
              placeholder: "Ex: 6\xE8me, 5\xE8me, Seconde",
              style: {
                width: "100%",
                padding: "10px",
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "14px"
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: () => {
                setShowAddClasse(false);
                setNewClasse({ nom: "", niveauId: "" });
              },
              style: {
                padding: "10px 20px",
                background: "#95a5a6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              },
              children: "Annuler"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: ajouterClasse,
              style: {
                padding: "10px 20px",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              },
              children: "Ajouter"
            }
          )
        ] })
      ] }) }),
      showAddMatiere && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles.modal, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
        ...styles.modalContent,
        maxWidth: "600px",
        maxHeight: "80vh",
        overflow: "auto"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { marginTop: 0, color: "#2c3e50" }, children: "Ajouter une mati\xE8re" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: {
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
            color: "#2c3e50"
          }, children: "Nom de la mati\xE8re" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "text",
              value: newMatiere.nom,
              onChange: (e) => setNewMatiere({ ...newMatiere, nom: e.target.value }),
              placeholder: "Ex: Fran\xE7ais, Math\xE9matiques",
              style: {
                width: "100%",
                padding: "10px",
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "14px"
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "20px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: {
            display: "block",
            marginBottom: "10px",
            fontWeight: "600",
            color: "#2c3e50"
          }, children: "Classes concern\xE9es" }),
          niveaux.map((niveau) => {
            const classesNiveau = getClassesByNiveau(niveau.id);
            if (classesNiveau.length === 0) return null;
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                style: {
                  marginBottom: "15px",
                  padding: "15px",
                  background: "#f8f9fa",
                  borderRadius: "8px"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
                    fontWeight: "bold",
                    marginBottom: "10px",
                    color: "#667eea",
                    fontSize: "15px"
                  }, children: niveau.nom }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: "10px" }, children: classesNiveau.map((classe) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                    "label",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        cursor: "pointer",
                        padding: "8px 12px",
                        background: newMatiere.classeIds.includes(classe.id) ? "#667eea" : "white",
                        color: newMatiere.classeIds.includes(classe.id) ? "white" : "#2c3e50",
                        border: "2px solid #667eea",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "600",
                        transition: "all 0.3s ease"
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                          "input",
                          {
                            type: "checkbox",
                            checked: newMatiere.classeIds.includes(classe.id),
                            onChange: () => toggleClasseForMatiere(classe.id),
                            style: { cursor: "pointer" }
                          }
                        ),
                        classe.nom
                      ]
                    },
                    classe.id
                  )) })
                ]
              },
              niveau.id
            );
          })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: () => {
                setShowAddMatiere(false);
                setNewMatiere({ nom: "", classeIds: [] });
              },
              style: {
                padding: "10px 20px",
                background: "#95a5a6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              },
              children: "Annuler"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: ajouterMatiere,
              style: {
                padding: "10px 20px",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              },
              children: "Ajouter"
            }
          )
        ] })
      ] }) })
    ] });
  };
  var pedaclic_admin_panel_default = AdminPanel;
  return __toCommonJS(pedaclic_admin_panel_exports);
})();
