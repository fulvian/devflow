1. Riavvio Sicuro dei Servizi

  # Stop controllato con validazione
  ./devflow-stop.sh && \
  pgrep -f "node|devflow" || echo "✅ Tutti i processi fermati"

  # Avvio con logging avanzato
  SYNTHETIC_API_DEBUG=1 ./devflow-start.sh | tee /tmp/devflow-start-$(date +%s).log

  2. Validazione Post-Riavvio

  # Controllo heartbeat
  curl -s http://localhost:8080/status | jq '.services[] | select(.name=="synthetic-api")'

  # Verifica connessione API
  mcp__devflow-synthetic-cc-sessions__synthetic_context \
    --task_id "DEVFLOW-VALID-03A" \
    --content "$(cat /tmp/devflow-start-*.log)" \
    --analysis_type "extract" \
    --focus "errori avvio"

  3. Aggiornamento Database (se necessario)

  sqlite3 devflow.sqlite <<EOF
  UPDATE service_configs
  SET api_endpoint='https://api.synthetic.new/v1',
      api_key_hash='$(echo -n "syn_4f04a1a3108cfbb64ac973367542d361" | sha256sum)'
  WHERE service_name='SyntheticAPI';
  EOF

  4. Pulizia e Ottimizzazione

  # Rimozione log temporanei
  find /tmp/devflow-start-*.log -mtime +1 -delete

  # Aggiornamento docs
  echo "Configurazione aggiornata il $(date):\n- Endpoint: api.synthetic.new\n- Key:
  ***$(echo $SYNTHETIC_API_KEY | tail -c 6)" >> docs/CHANGELOG.md

  5. Monitoraggio Continuo