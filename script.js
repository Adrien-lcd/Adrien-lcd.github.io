/*
 * SCRIPT CLIENT - VERSION LISTES INTELLIGENTES
 * 1. Affiche les RDV existants avec Nom + Durée.
 * 2. Date : Liste déroulante des jours ouverts uniquement.
 * 3. Heure : Liste déroulante calculée (Horaires - RDV existants).
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbxuHIOaJrAwoqyxixiONlDa3Xya7E7FwOJWe-MQiI9Z6XNiUWk4_XX10FYTF2bMcKI2vA/exec";

let allAppointments = [];
let allAvailabilities = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments du DOM ---
    const dateSelect = document.getElementById('date-select');
    const timeSelect = document.getElementById('time-select');
    const availabilityDisplay = document.getElementById('availability-display');
    const bookingForm = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-btn');
    
    // Champs
    const durationSlider = document.getElementById('duration-slider');
    const durationValue = document.getElementById('duration-value');
    const clientName = document.getElementById('client-name');
    const clientEmail = document.getElementById('client-email');
    const clientMessage = document.getElementById('client-message');
    const toastContainer = document.getElementById('toast-container');

    // --- Listeners ---

    // 1. Changement de durée -> Recalcul des créneaux horaires
    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
        if (dateSelect.value) {
            updateTimeSlots(dateSelect.value);
        }
    });

    // 2. Changement de date -> Affiche les infos et recalcule les heures
    dateSelect.addEventListener('change', () => {
        const selectedDate = dateSelect.value;
        if (selectedDate) {
            renderDayDetails(selectedDate);
            updateTimeSlots(selectedDate);
        } else {
            availabilityDisplay.innerHTML = "";
            timeSelect.innerHTML = '<option value="">-- Choisissez une date --</option>';
        }
    });

    // 3. Soumission
    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- Démarrage ---
    loadInitialData();


    // --- Logique Principale ---

    async function loadInitialData() {
        try {
            const response = await fetch(GAS_URL);
            const data = await response.json();

            if (data.status === "success") {
                allAppointments = data.rdv;
                allAvailabilities = data.disponibilites;
                
                // On remplit le menu déroulant des DATES
                populateDateSelect();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error(error);
            showToast("Erreur de chargement: " + error.message, "error");
            dateSelect.innerHTML = '<option>Erreur de connexion</option>';
        }
    }

    /**
     * Remplit la liste déroulante uniquement avec les jours ouverts
     */
    function populateDateSelect() {
        dateSelect.innerHTML = '<option value="">-- Sélectionner une date --</option>';
        
        const today = new Date();
        today.setHours(0,0,0,0);
        let count = 0;

        // On cherche les 30 prochains jours
        for (let i = 0; i < 30; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            
            // Format technique pour la comparaison (YYYY-MM-DD)
            const dateKey = day.toLocaleDateString('fr-CA'); 
            
            // Format joli pour l'utilisateur
            const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(day);

            // Est-ce ouvert ce jour-là ?
            const isOpen = allAvailabilities.find(a => a.date === dateKey && a.openTime);

            if (isOpen) {
                const option = document.createElement('option');
                option.value = dateKey;
                option.textContent = `📅 ${label}`;
                dateSelect.appendChild(option);
                count++;
            }
        }

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Aucune disponibilité trouvée";
            dateSelect.appendChild(option);
        }
    }

    /**
     * Affiche les RDV déjà pris (BUG FIX: Affiche Nom + Heure)
     */
    function renderDayDetails(dateKey) {
        const availability = allAvailabilities.find(a => a.date === dateKey);
        
        // On filtre TOUS les RDV de ce jour (confirmés ou pending)
        const dayRdvs = allAppointments.filter(rdv => rdv.date === dateKey);

        let html = `<div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #ddd;">`;
        html += `<p><strong>Horaires d'ouverture :</strong> ${availability.openTime} - ${availability.closeTime}</p>`;

        if (dayRdvs.length > 0) {
            html += `<h5>⚠️ Rendez-vous déjà planifiés :</h5><ul style="padding-left: 20px;">`;
            
            // Tri par heure
            dayRdvs.sort((a, b) => a.time.localeCompare(b.time));

            dayRdvs.forEach(rdv => {
                // Calcul heure fin
                const [h, m] = rdv.time.split(':').map(Number);
                const endDate = new Date(0,0,0, h, m + parseInt(rdv.duration));
                const endStr = endDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

                // BUG FIX : On affiche le NOM du client
                // On met une icône différente si confirmé ou en attente
                const icon = rdv.status === 'confirmed' ? '❌ Occupé' : '⏳ En attente';
                
                html += `<li>
                    <strong>${rdv.time} - ${endStr}</strong> : ${icon} 
                    <br><span style="font-size: 0.9em; color: #666;">Client : ${rdv.client_name} (${rdv.duration} min)</span>
                </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p><em>Aucun rendez-vous pour le moment. La journée est libre.</em></p>`;
        }
        html += `</div>`;
        
        availabilityDisplay.innerHTML = html;
    }


    /**
     * GÉNIE LOGIQUE : Calcule les créneaux disponibles
     * Algorithme :
     * 1. On part de l'heure d'ouverture.
     * 2. On avance par pas de 15 min.
     * 3. Pour chaque pas, on regarde si [Heure -> Heure+Durée] touche un RDV confirmé.
     * 4. Si ça touche pas, on ajoute à la liste.
     */
    function updateTimeSlots(dateKey) {
        timeSelect.innerHTML = "";
        
        const availability = allAvailabilities.find(a => a.date === dateKey);
        if (!availability) return;

        // Récupération des RDV confirmés qui bloquent
        const blockers = allAppointments.filter(
            rdv => rdv.date === dateKey && rdv.status === 'confirmed'
        );

        const openMinutes = timeToMinutes(availability.openTime);
        const closeMinutes = timeToMinutes(availability.closeTime);
        const duration = parseInt(durationSlider.value);

        let count = 0;

        // Boucle : on teste chaque quart d'heure
        for (let time = openMinutes; time + duration <= closeMinutes; time += 15) {
            
            const slotStart = time;
            const slotEnd = time + duration;
            let isFree = true;

            // Vérification de collision avec les RDV existants
            for (let rdv of blockers) {
                const rdvStart = timeToMinutes(rdv.time);
                const rdvEnd = rdvStart + parseInt(rdv.duration);

                // Formule mathématique de collision d'intervalles :
                // (Start1 < End2) && (End1 > Start2)
                if (slotStart < rdvEnd && slotEnd > rdvStart) {
                    isFree = false;
                    break; // Pas la peine de vérifier les autres RDV
                }
            }

            if (isFree) {
                const option = document.createElement('option');
                option.value = minutesToTime(slotStart);
                option.textContent = `${minutesToTime(slotStart)} (${duration} min)`;
                timeSelect.appendChild(option);
                count++;
            }
        }

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Aucun créneau disponible pour cette durée";
            timeSelect.appendChild(option);
        }
    }


    // --- Soumission ---
    async function handleFormSubmit(event) {
        event.preventDefault();

        const selectedDate = dateSelect.value;
        const selectedTime = timeSelect.value;

        if (!selectedDate || !selectedTime || selectedTime.includes("Aucun")) {
            showToast("Veuillez sélectionner une date et un créneau valide.", "error");
            return;
        }

        const newRdv = {
            date: selectedDate,
            time: selectedTime,
            duration: parseInt(durationSlider.value, 10),
            client_name: clientName.value,
            client_email: clientEmail.value,
            message: clientMessage.value
        };

        submitButton.disabled = true;
        submitButton.textContent = "Envoi en cours...";

        try {
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(newRdv),
            });
            
            const result = await response.json();

            if (result.status === "success") {
                showToast("RDV confirmé ! En attente de validation.", "success");
                bookingForm.reset();
                // On recharge pour mettre à jour les listes
                setTimeout(() => loadInitialData(), 1000);
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            showToast("Erreur: " + error.message, "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Envoyer la demande";
        }
    }

    // --- Utilitaires ---

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function showToast(msg, type) {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        toastContainer.appendChild(t);
        setTimeout(() => t.classList.add('show'), 100);
        setTimeout(() => {
            t.classList.remove('show'); 
            t.remove();
        }, 3000);
    }
});
