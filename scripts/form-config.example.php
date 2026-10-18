<?php
// Пример конфига для public/api/form.php.
// Боевой файл кладётся на хостинг ВНЕ webroot: /home/r/redegun/taknaprimer/form-config.php (в git не попадает).
return [
    'to' => ['taknaprimer@yandex.ru'],          // куда слать письма (можно несколько)
    'from' => 'site@taknaprimer.ru',
    // Telegram через релей на VPS (Timeweb не достаёт до api.telegram.org напрямую)
    'relay' => 'https://r.antonvetrov.ru/_tg/send',
    'relay_auth' => '',                          // TG_RELAY_AUTH из /etc/tg-relay.env на VPS
    'bot_token' => '',                           // токен бота
    'chat_id' => '',                             // chat_id Тани (или Антона)
];
