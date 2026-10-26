<?php
// Лайки («Оценить») и просмотры для кейсов и постов. Статика на Timeweb, PHP 7.2 в подпапке (без стрелочных функций!).
// GET  ?slug=<slug>                → {"ok":true,"count":N,"views":M,"liked":bool}
// GET  ?all=1                      → {"ok":true,"counts":{slug:N},"views":{slug:M}}
// POST slug=<slug>                 → лайк +1, если с этого устройства ещё не голосовали (отпечаток IP+UA)
// POST slug=<slug>&action=view     → просмотр +1, не чаще раза в сутки с устройства
// Хранилище вне webroot: /home/r/redegun/taknaprimer/likes.json (создаётся само).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$docroot = rtrim(isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '', '/');
$home = $docroot ? dirname($docroot) : dirname(__DIR__, 2);
$store = $home . '/likes.json';

$slugRaw = isset($_POST['slug']) ? $_POST['slug'] : (isset($_GET['slug']) ? $_GET['slug'] : '');
$slug = trim(preg_replace('/[^a-z0-9\-\/]/', '', strtolower((string)$slugRaw)), '/');
$action = isset($_POST['action']) ? $_POST['action'] : 'like';

$fh = fopen($store, 'c+');
if (!$fh) { http_response_code(500); echo json_encode(array('ok' => false)); exit; }
flock($fh, LOCK_EX);
$raw = stream_get_contents($fh);
$data = $raw ? json_decode($raw, true) : null;
if (!is_array($data)) $data = array('counts' => array(), 'views' => array(), 'voters' => array(), 'viewers' => array());
foreach (array('counts', 'views', 'voters', 'viewers') as $k) if (!isset($data[$k]) || !is_array($data[$k])) $data[$k] = array();
// переименованные кейсы: счётчики старого слага переезжают на новый (один раз, при первом обращении)
$renamed = array('analogovyy-apdeyt' => 'skotch-koding');
$moved = false;
foreach ($renamed as $old => $new) {
    foreach (array('counts', 'views') as $k) {
        if (isset($data[$k][$old])) {
            $data[$k][$new] = (isset($data[$k][$new]) ? $data[$k][$new] : 0) + $data[$k][$old];
            unset($data[$k][$old]);
            $moved = true;
        }
    }
}
if ($moved) save($fh, $data);

$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
$ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
$fp = hash('sha256', $ip . '|' . $ua . '|' . $slug);

function save($fh, $data) {
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE));
    fflush($fh);
}
function prune(&$list, $max, $ttl) {
    if (count($list) > $max) {
        $cut = time() - $ttl;
        $keep = array();
        foreach ($list as $k => $t) if ($t > $cut) $keep[$k] = $t;
        $list = $keep;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($slug === '' || strlen($slug) > 80) { http_response_code(422); echo json_encode(array('ok' => false)); flock($fh, LOCK_UN); exit; }
    if ($action === 'view') {
        $day = $fp . '|' . date('Y-m-d');
        if (!isset($data['viewers'][$day])) {
            $data['viewers'][$day] = time();
            $data['views'][$slug] = (isset($data['views'][$slug]) ? $data['views'][$slug] : 0) + 1;
            prune($data['viewers'], 20000, 2 * 86400);
            save($fh, $data);
        }
    } else {
        if (!isset($data['voters'][$fp])) {
            $data['voters'][$fp] = time();
            $data['counts'][$slug] = (isset($data['counts'][$slug]) ? $data['counts'][$slug] : 0) + 1;
            prune($data['voters'], 50000, 365 * 86400);
            save($fh, $data);
        }
    }
    flock($fh, LOCK_UN); fclose($fh);
    echo json_encode(array('ok' => true,
        'count' => isset($data['counts'][$slug]) ? $data['counts'][$slug] : 0,
        'views' => isset($data['views'][$slug]) ? $data['views'][$slug] : 0,
        'liked' => isset($data['voters'][$fp])));
    exit;
}

flock($fh, LOCK_UN); fclose($fh);
if (isset($_GET['all'])) {
    echo json_encode(array('ok' => true, 'counts' => (object)$data['counts'], 'views' => (object)$data['views']));
    exit;
}
echo json_encode(array('ok' => true,
    'count' => isset($data['counts'][$slug]) ? $data['counts'][$slug] : 0,
    'views' => isset($data['views'][$slug]) ? $data['views'][$slug] : 0,
    'liked' => isset($data['voters'][$fp])));
