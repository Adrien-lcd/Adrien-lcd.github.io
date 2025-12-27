/*
 * SCRIPT CLIENT - VERSION FINALE (ROBUSTE)
 * * CORRECTIONS MAJEURES :
 * 1. [FORMAT DATE] Gère automatiquement les dates "JJ/MM/AAAA" (Sheet) vs "AAAA-MM-JJ" (Site).
 * 2. [COLONNES] Tolère les majuscules/minuscules dans les en-têtes (Date vs date).
 * 3. [STATUT] Reconnaît "Confirmed", "Validé", "confirmé" comme valides.
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

    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
        if (dateSelect.value) updateTimeSlots(dateSelect.value);
    });

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

    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- Démarrage ---
    loadInitialData();


    // --- Logique Principale ---

    async function loadInitialData() {
        try {
            const response = await fetch(GAS_URL);
            const data = await response.json();

            if (data.status === "success") {
                // 1. On uniformise les noms de colonnes (minuscules)
                let rawRdv = normalizeKeys(data.rdv);
                let rawAvail = normalizeKeys(data.disponibilites);

                // 2. On uniformise les VALEURS de dates (JJ/MM/AAAA -> AAAA-MM-JJ)
                allAppointments = rawRdv.map(item => ({
                    ...item,
                    date: normalizeDateValue(item.date)
                }));
                
                allAvailabilities = rawAvail.map(item => ({
                    ...item,
                    date: normalizeDateValue(item.date)
                }));
                
                console.log("Données RDV chargées :", allAppointments);
                console.log("Données Dispo chargées :", allAvailabilities);

                populateDateSelect();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error(error);
            showToast("Erreur chargement: " + error.message, "error");
            dateSelect.innerHTML = '<option>Erreur de connexion</option>';
        }
    }

    /*
     * Convertit une date "JJ/MM/AAAA" (Excel/Sheet FR) en "AAAA-MM-JJ" (JS Standard)
     * Si la date est déjà "AAAA-MM-JJ", on la garde telle quelle.
     */
    function normalizeDateValue(dateStr) {
        if (!dateStr) return "";
        
        // Si c'est déjà au format AAAA-MM-JJ (ex: 2025-11-03)
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            return dateStr.substring(0, 10);
        }
        
        // Si c'est au format JJ/MM/AAAA (ex: 03/11/2025)
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // On inverse : Jour/Mois/Année -> Année-Mois-Jour
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        return dateStr;
    }

    /*
     * Met toutes les clés (colonnes) en minuscules pour éviter les erreurs "Date" vs "date"
     */
    function normalizeKeys(list) {
        if (!list) return [];
        return list.map(item => {
            const newItem = {};
            for (const key in item) {
                let newKey = key.toLowerCase().trim();
                // Mapping de sécurité
                if (newKey.includes('date')) newKey = 'date';
                if (newKey.includes('time') || newKey.includes('heure')) newKey = 'time';
                if (newKey.includes('duration') || newKey.includes('durée')) newKey = 'duration';
                if (newKey.includes('open')) newKey = 'opentime';
                if (newKey.includes('close')) newKey = 'closetime';
                if (newKey.includes('stat')) newKey = 'status';
                if (newKey.includes('nom') || newKey.includes('client')) newKey = 'client_name';
                
                newItem[newKey] = item[key];
            }
            return newItem;
        });
    }

    function populateDateSelect() {
        dateSelect.innerHTML = '<option value="">-- Sélectionner une date --</option>';
        const today = new Date();
        today.setHours(0,0,0,0);
        let count = 0;

        for (let i = 0; i < 60; i++) { // On regarde sur 60 jours
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            const dateKey = day.toLocaleDateString('fr-CA'); // AAAA-MM-JJ
            
            const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(day);

            // Recherche exacte maintenant que tout est normalisé
            const isOpen = allAvailabilities.find(a => a.date === dateKey && a.opentime);

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

    function renderDayDetails(dateKey) {
        const availability = allAvailabilities.find(a => a.date === dateKey);
        
        // Filtre les RDV pour ce jour
        const dayRdvs = allAppointments.filter(rdv => rdv.date === dateKey);

        let html = `<div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #ddd;">`;
        if (availability) {
            html += `<p><strong>Horaires d'ouverture :</strong> ${availability.opentime} - ${availability.closetime}</p>`;
        }

        if (dayRdvs.length > 0) {
            html += `<h5>⚠️ Rendez-vous déjà pris :</h5><ul style="padding-left: 20px;">`;
            dayRdvs.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

            dayRdvs.forEach(rdv => {
                if (!rdv.time) return;

                const [h, m] = rdv.time.split(':').map(Number);
                const endDate = new Date(0,0,0, h, m + parseInt(rdv.duration || 30));
                const endStr = endDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

                // Gestion souple du statut
                const status = (rdv.status || "").toLowerCase();
                // On considère occupé si c'est confirmé OU validé
                const isConfirmed = status.includes('confirm') || status.includes('valid');
                
                const icon = isConfirmed ? '❌ Occupé' : '⏳ En attente';
                const nomClient = rdv.client_name || "Client";

                html += `<li>
                    <strong>${rdv.time} - ${endStr}</strong> : ${icon} 
                    <br><span style="font-size: 0.9em; color: #666;">${nomClient} (${rdv.duration} min)</span>
                </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p><em>Aucun rendez-vous pour le moment.</em></p>`;
        }
        html += `</div>`;
        availabilityDisplay.innerHTML = html;
    }

    function updateTimeSlots(dateKey) {
        timeSelect.innerHTML = "";
        const availability = allAvailabilities.find(a => a.date === dateKey);
        if (!availability) return;

        // On bloque les créneaux des RDV confirmés
        const blockers = allAppointments.filter(rdv => {
            if (rdv.date !== dateKey) return false;
            const s = (rdv.status || "").toLowerCase();
            return s.includes('confirm') || s.includes('valid');
        });

        const openMinutes = timeToMinutes(availability.opentime);
        const closeMinutes = timeToMinutes(availability.closetime);
        const duration = parseInt(durationSlider.value);

        let count = 0;

        for (let time = openMinutes; time + duration <= closeMinutes; time += 15) {
            const slotStart = time;
            const slotEnd = time + duration;
            let isFree = true;

            for (let rdv of blockers) {
                if (!rdv.time) continue;
                const rdvStart = timeToMinutes(rdv.time);
                const rdvEnd = rdvStart + parseInt(rdv.duration || 30);

                // Collision ?
                if (slotStart < rdvEnd && slotEnd > rdvStart) {
                    isFree = false;
                    break;
                }
            }

            if (isFree) {
                const option = document.createElement('option');
                option.value = minutesToTime(slotStart);
                option.textContent = `${minutesToTime(slotStart)}`;
                timeSelect.appendChild(option);
                count++;
            }
        }

        if (count === 0) {
            const option = document.createElement('option');
            option.textContent = "Complet pour cette durée";
            timeSelect.appendChild(option);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const selectedDate = dateSelect.value;
        const selectedTime = timeSelect.value;

        if (!selectedDate || !selectedTime || selectedTime.includes("Complet") || selectedTime.includes("Choisissez")) {
            showToast("Date ou heure invalide.", "error");
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
        submitButton.textContent = "Envoi...";

        try {
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(newRdv),
            });
            const result = await response.json();

            if (result.status === "success") {
                showToast("RDV envoyé ! Attente validation.", "success");
                bookingForm.reset();
                setTimeout(() => loadInitialData(), 1500);
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

    function timeToMinutes(timeStr) {
        if(!timeStr) return 0;
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
            t.classList.remove('show'); t.remove();
        }, 3000);
    }
});
