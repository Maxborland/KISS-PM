<?php
/**
 * KISS PM landing — waitlist endpoint для shared-хостинга (reg.ru, PHP).
 * Зеркалит серверный пайплайн Node-версии: honeypot -> валидация ->
 * SQLite (вне docroot) -> Telegram. Контракт ответа совпадает с
 * /api/waitlist из Astro-версии, фронтенд не меняется.
 *
 * Секреты: <ftp-root>/kisspm-data/config.php (НЕ в docroot, не в git).
 */

declare(strict_types=1);

header('content-type: application/json; charset=utf-8');
header('cache-control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$docroot = $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__);
$dataDir = dirname($docroot, 2) . '/kisspm-data';
$config = is_file($dataDir . '/config.php') ? require $dataDir . '/config.php' : [];

$allowedOrigins = isset($config['allowed_origins']) && is_array($config['allowed_origins'])
    ? $config['allowed_origins']
    : [];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($allowedOrigins !== [] && $origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    respond(403, ['ok' => false, 'error' => 'origin_not_allowed']);
}

$src = $_POST;
if ($src === []) {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw === false ? 'null' : $raw, true);
    $src = is_array($decoded) ? $decoded : [];
}
$field = function (string $key) use ($src): string {
    return trim((string) ($src[$key] ?? ''));
};

// Honeypot: боту отвечаем «ок», ничего не сохраняя.
if ($field('hp') !== '') {
    respond(200, ['ok' => true, 'status' => 'received']);
}

$fullName = $field('fullName');
$email = mb_strtolower($field('email'));
$company = $field('company');
$role = $field('role');
$companySize = $field('companySize');
$context = mb_substr($field('context'), 0, 600);
$consent = $field('consent');

$issues = [];
if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 120) {
    $issues['fullName'] = ['Укажите имя и фамилию'];
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > 254) {
    $issues['email'] = ['Похоже, в адресе опечатка'];
}
if (mb_strlen($company) < 2 || mb_strlen($company) > 120) {
    $issues['company'] = ['Укажите компанию'];
}
if (mb_strlen($role) < 2 || mb_strlen($role) > 80) {
    $issues['role'] = ['Укажите роль или должность'];
}
if (!in_array($companySize, ['solo', 'small', 'mid', 'large', 'enterprise', 'other'], true)) {
    $issues['companySize'] = ['Выберите диапазон проектов'];
}
if (!in_array($consent, ['on', 'true', '1'], true)) {
    $issues['consent'] = ['Нужно согласие с условиями альфы'];
}
if ($issues !== []) {
    respond(400, ['ok' => false, 'error' => 'validation_error', 'issues' => $issues]);
}

if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0700, true);
}

try {
    $db = new PDO('sqlite:' . $dataDir . '/waitlist.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec(
        "CREATE TABLE IF NOT EXISTS waitlist_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            full_name TEXT NOT NULL,
            company TEXT,
            role TEXT NOT NULL,
            company_size TEXT NOT NULL,
            context TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            source TEXT NOT NULL DEFAULT 'landing',
            ip_hash TEXT,
            user_agent TEXT,
            consent_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            reviewed_at TEXT,
            reviewer_note TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS waitlist_submissions_email_uniq
          ON waitlist_submissions (email);
        CREATE INDEX IF NOT EXISTS waitlist_submissions_status_idx
          ON waitlist_submissions (status, created_at DESC);"
    );
} catch (PDOException $e) {
    error_log('[waitlist] db open failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'server_error']);
}

$salt = (string) ($config['ip_salt'] ?? '');
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$ipHash = ($ip !== '' && $salt !== '')
    ? substr(hash('sha256', $salt . ':' . $ip), 0, 32)
    : null;

// Rate limit: не больше 5 принятых заявок в минуту с одного IP.
if ($ipHash !== null) {
    $stmt = $db->prepare(
        "SELECT COUNT(*) FROM waitlist_submissions
         WHERE ip_hash = ? AND created_at > datetime('now', '-60 seconds')"
    );
    $stmt->execute([$ipHash]);
    if ((int) $stmt->fetchColumn() >= 5) {
        respond(429, ['ok' => false, 'error' => 'rate_limited', 'retryInMs' => 60000]);
    }
}

try {
    $stmt = $db->prepare(
        "INSERT INTO waitlist_submissions
           (email, full_name, company, role, company_size, context, ip_hash, user_agent, consent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    );
    $stmt->execute([
        $email,
        $fullName,
        $company,
        $role,
        $companySize,
        $context !== '' ? $context : null,
        $ipHash,
        substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 240),
    ]);
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'UNIQUE') !== false) {
        // Дубликат email считаем успехом, чтобы не палить, кто уже записан.
        respond(200, ['ok' => true, 'status' => 'received']);
    }
    error_log('[waitlist] insert failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'server_error']);
}

$token = (string) ($config['telegram_token'] ?? '');
$chatId = (string) ($config['telegram_chat_id'] ?? '');
if ($token !== '' && $chatId !== '') {
    $sizeLabels = [
        'solo' => 'До 10 проектов',
        'small' => '10–30 проектов',
        'mid' => '30–50 проектов',
        'large' => '50–100 проектов',
        'enterprise' => '100+ проектов',
        'other' => 'Другое',
    ];
    $lines = [
        '🆕 Заявка в альфу KISS PM',
        '',
        'Имя: ' . $fullName,
        'Email: ' . $email,
        'Компания: ' . $company,
        'Роль: ' . $role,
        'Портфель: ' . ($sizeLabels[$companySize] ?? $companySize),
    ];
    if ($context !== '') {
        $lines[] = 'Контекст: ' . $context;
    }
    $payload = json_encode(
        ['chat_id' => $chatId, 'text' => implode("\n", $lines)],
        JSON_UNESCAPED_UNICODE
    );
    $streamContext = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "content-type: application/json\r\n",
            'content' => $payload,
            'timeout' => 6,
        ],
    ]);
    $response = @file_get_contents(
        'https://api.telegram.org/bot' . $token . '/sendMessage',
        false,
        $streamContext
    );
    if ($response === false) {
        error_log('[waitlist] telegram notify failed');
    }
}

respond(200, ['ok' => true, 'status' => 'received']);
