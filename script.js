/*
 * SCRIPT CLIENT (FRONTEND)
 * Gère l'interaction avec la page HTML et l'API Google Sheets
 */

// ----------------------------------------------------------------
// ⚠️ MODIFIEZ CECI !
// Collez l'URL de votre application web Apps Script ici
const GAS_URL = "https://adrien-lcd.github.io/";
// ----------------------------------------------------------------


// --- Variables globales pour stocker les données ---
let allAppointments = [];
let allAvailabilities = [];


// --- Sélection des éléments HTML (DOM) ---
// On attend que le HTML soit chargé
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments principaux ---
    const datePicker = document.getElementById('date-picker');
    const availabilityDisplay = document.getElementById('availability-display');
    const bookingForm = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-btn');
    
    // --- Champs du formulaire ---
    const timeInput = document.getElementById('time-input');
    const durationSlider = document.getElementById('duration-slider');
    const durationValue = document.getElementById('duration-value');
    const clientName = document.getElementById('client-name');
    const clientEmail = document.getElementById('client-email');
    const clientMessage = document.getElementById('client-message');
    
    // --- Zone de notification ---
    const toastContainer = document.getElementById('toast-container');

    
    // --- Écouteurs d'événements ---

    // 1. Mettre à jour la valeur du slider en temps réel
    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
    });

    // 2. Charger les disponibilités quand la date change
    datePicker.addEventListener('change', handleDateChange);

    // 3. Envoyer le formulaire
    bookingForm.addEventListener('submit', handleFormSubmit);


    // --- Fonctions principales ---

    /**
     * Appelé quand l'utilisateur change la date
     */
    async function handleDateChange() {
        const selectedDate = datePicker.value; // Format: "AAAA-MM-JJ"
        if (!selectedDate) return;

        availabilityDisplay.innerHTML = "<p>Chargement des disponibilités...</p>";

        try {
            // Appelle l'API (notre script doGet)
            const response = await fetch(GAS_URL);
            if (!response.ok) {
                throw new Error("Erreur réseau lors de la récupération des données.");
            }
            const data = await response.json();

            if (data.status === "success") {
                // Stocke les données globalement
                allAppointments = data.rdv;
                allAvailabilities = data.disponibilites;
                
                // Affiche les infos pour la date choisie
                renderAvailability(selectedDate);
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error("Erreur (handleDateChange):", error);
            availabilityDisplay.innerHTML = `<p style="color: red;">Impossible de charger les données: ${error.message}</p>`;
        }
    }

    /**
     * Affiche les infos de disponibilité et les RDV pour la date choisie
     */
    function renderAvailability(selectedDate) {
        // Trouve les heures d'ouverture pour ce jour
        const availability = allAvailabilities.find(a => a.date === selectedDate);
        
        // Filtre les RDV (confirmés ou en attente) pour ce jour
        const appointmentsForDay = allAppointments.filter(rdv => rdv.date === selectedDate);

        let html = "";

        if (availability && availability.openTime) {
            html += `<h3>Disponibilités le ${selectedDate}</h3>`;
            html += `<p>✅ Ouvert de <strong>${availability.openTime}</strong> à <strong>${availability.closeTime}</strong></p>`;
            
            if (appointmentsForDay.length > 0) {
                html += "<h4>Rendez-vous déjà planifiés :</h4><ul>";
                
                // Tri des RDV par heure
                appointmentsForDay.sort((a, b) => a.time.localeCompare(b.time));
                
                appointmentsForDay.forEach(rdv => {
                    // Calcule l'heure de fin
                    const [hours, minutes] = rdv.time.split(':').map(Number);
                    const endDate = new Date(2000, 0, 1, hours, minutes + rdv.duration);
                    const endTime = endDate.toTimeString().substring(0, 5);

                    // Code couleur des statuts
                    let statusClass = "status-pending"; // Jaune (CSS non défini, mais logique prête)
                    if (rdv.status === "confirmed") {
                        statusClass = "status-confirmed"; // Vert
                    }

                    html += `<li class="${statusClass}"><strong>${rdv.time}</strong> à <strong>${endTime}</strong> (${rdv.duration} min) - <em>Statut: ${rdv.status}</em></li>`;
                });
                html += "</ul>";
            } else {
                html += "<p>Aucun rendez-vous pour l'instant.</p>";
            }

        } else {
            html += `<h3>Disponibilités le ${selectedDate}</h3>`;
            html += "<p>❌ Le coiffeur n'est pas disponible ce jour-là.</p>";
        }

        availabilityDisplay.innerHTML = html;
    }


    /**
     * Appelé quand l'utilisateur soumet le formulaire
     */
    async function handleFormSubmit(event) {
        event.preventDefault(); // Empêche la page de se recharger

        // --- 1. Récupération des données du formulaire ---
        const newRdv = {
            date: datePicker.value,
            time: timeInput.value,
            duration: parseInt(durationSlider.value, 10),
            client_name: clientName.value,
            client_email: clientEmail.value,
            message: clientMessage.value
        };

        // --- 2. Validation simple ---
        if (!newRdv.date || !newRdv.time) {
            showToast("Veuillez choisir une date et une heure.", "error");
            return;
        }

        // --- 3. Détection de chevauchement  ---
        if (checkConflict(newRdv, allAppointments)) {
            showToast("Conflit d'horaire ! L'heure que vous avez choisie est déjà prise.", "error");
            return;
        }

        // --- 4. Envoi des données (POST) ---
        submitButton.disabled = true;
        submitButton.textContent = "Envoi en cours...";

        try {
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors", // Nécessaire pour les appels cross-domain
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newRdv),
            });

            const result = await response.json();

            if (result.status === "success") {
                showToast("Demande de RDV envoyée avec succès ! (Statut: En attente)", "success");
                bookingForm.reset(); // Vide le formulaire
                durationValue.textContent = "30"; // Réinitialise le slider
                
                // Recharge les données pour afficher le nouveau RDV "pending"
                await handleDateChange(); 
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Erreur (handleFormSubmit):", error);
            showToast(`Erreur lors de l'envoi: ${error.message}`, "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Envoyer la demande";
        }
    }

    /**
     * Vérifie si le nouveau RDV entre en conflit avec des RDV existants
     */
    function checkConflict(newRdv, existingAppointments) {
        // Convertit le nouveau RDV en objets Date
        const newStart = parseDateTime(newRdv.date, newRdv.time);
        const newEnd = new Date(newStart.getTime() + newRdv.duration * 60000); // Ajoute la durée en millisecondes

        // Filtre les RDV du même jour
        const appointmentsForDay = existingAppointments.filter(
            rdv => rdv.date === newRdv.date && rdv.status === "confirmed" // On ne vérifie que les RDV confirmés
        );

        for (const rdv of appointmentsForDay) {
            // Convertit le RDV existant en objets Date
            const existingStart = parseDateTime(rdv.date, rdv.time);
            const existingEnd = new Date(existingStart.getTime() + rdv.duration * 60000);

            // Logique de conflit :
            // (Le nouveau RDV commence AVANT la fin de l'existant) ET (Le nouveau RDV se termine APRES le début de l'existant)
            const isOverlap = newStart < existingEnd && newEnd > existingStart;
            
            if (isOverlap) {
                return true; // Conflit trouvé !
            }
        }
        return false; // Pas de conflit
    }


    // --- Fonctions utilitaires ---

    /**
     * Affiche une notification "toast" 
     */
    function showToast(message, type = "success") {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Animation d'apparition (CSS requis)
        setTimeout(() => toast.classList.add('show'), 100);

        // Disparition après 3 secondes
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    /**
     * Crée un objet Date JavaScript à partir d'une date (AAAA-MM-JJ) et d'une heure (HH:MM)
     */
    function parseDateTime(dateStr, timeStr) {
        const [year, month, day] = dateStr.split('-');
        const [hours, minutes] = timeStr.split(':');
        // Mois est 0-indexé en JS (0=Janvier, 11=Décembre)
        return new Date(year, month - 1, day, hours, minutes);
    }
});