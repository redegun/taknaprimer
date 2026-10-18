<?php
// Обработчик формы «Обсудить проект». Статический сайт на Timeweb, PHP в подпапке.
// Конфиг (вне webroot): /home/r/redegun/taknaprimer/form-config.php, возвращает массив:
//   ['to' => ['taknaprimer@yandex.ru'], 'from' => 'site@taknaprimer.ru',
//    'relay' => 'https://r.antonvetrov.ru/_tg/send', 'relay_auth' => '...', 'bot_token' => '...', 'chat_id' => '...']
// Порядок: записать в лог → сразу ответить браузеру → потом почта и Telegram (mail() на хостинге бывает медленным).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only']);
    exit;
}

// Папка над docroot (/home/r/redegun/taknaprimer): и для корня, и для /_preview/
$docroot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
$home = $docroot ? dirname($docroot) : dirname(__DIR__, 2);
if (!is_file($home . '/form-config.php')) {
    for ($d = __DIR__, $i = 0; $i < 6; $i++) {
        $d = dirname($d);
        if (is_file($d . '/form-config.php')) { $home = $d; break; }
    }
}
$cfgPath = $home . '/form-config.php';
$cfg = is_file($cfgPath) ? (include $cfgPath) : [];
$logPath = $home . '/form-inbox.log';

$clean = function ($v) { return trim(mb_substr(strip_tags((string)$v), 0, 2000)); };

// антиспам: honeypot + минимальное время заполнения
if (!empty($_POST['website'])) { echo json_encode(['ok' => true]); exit; }
$started = (int)($_POST['started'] ?? 0);
if ($started > 0 && (microtime(true) * 1000 - $started) < 2500) { echo json_encode(['ok' => true]); exit; }

$message = $clean($_POST['message'] ?? '');
$contact = $clean($_POST['contact'] ?? '');
if ($message === '' || $contact === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Напишите пару слов о проекте и как с вами связаться.']);
    exit;
}
$what = array_map($clean, (array)($_POST['what'] ?? []));
$who = $clean($_POST['who'] ?? '');
$when = $clean($_POST['when'] ?? '');
$page = $clean($_SERVER['HTTP_REFERER'] ?? '');

$lines = ['Новая заявка с taknaprimer.ru'];
if ($what) $lines[] = 'Что: ' . implode(', ', $what);
if ($who) $lines[] = 'Для кого: ' . $who;
if ($when) $lines[] = 'Когда: ' . $when;
$lines[] = 'Контакт: ' . $contact;
$lines[] = '';
$lines[] = $message;
$lines[] = '';
$lines[] = 'Страница: ' . $page;
$lines[] = 'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? '') . ' · ' . date('Y-m-d H:i');
$text = implode("\n", $lines);

// 1. Лог вне webroot — заявка не теряется, даже если почта упала
@file_put_contents($logPath, "----- " . date('c') . "\n" . $text . "\n\n", FILE_APPEND | LOCK_EX);

// 2. Ответ браузеру сразу
ignore_user_abort(true);
set_time_limit(60);
$body = json_encode(['ok' => true]);
header('Content-Length: ' . strlen($body));
header('Connection: close');
echo $body;
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    @ob_end_flush();
    flush();
}

// 3. Почта
if (!empty($cfg['to'])) {
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с taknaprimer.ru: ' . mb_substr($message, 0, 50)) . '?=';
    $headers = "From: " . ($cfg['from'] ?? 'site@taknaprimer.ru') . "\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    foreach ((array)$cfg['to'] as $to) {
        @mail($to, $subject, $text, $headers);
    }
}

// 4. Telegram через релей на VPS (с Timeweb api.telegram.org недоступен)
if (!empty($cfg['relay']) && !empty($cfg['bot_token']) && !empty($cfg['chat_id'])) {
    // parse_mode '' = plain text: в заявке могут быть < > &, с HTML-режимом Telegram их отвергнет
    $payload = json_encode(['token' => $cfg['bot_token'], 'chat_id' => $cfg['chat_id'], 'text' => $text, 'parse_mode' => ''], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    $ch = curl_init($cfg['relay']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Relay-Auth: ' . ($cfg['relay_auth'] ?? '')],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
    ]);
    curl_exec($ch);
    curl_close($ch);
}
