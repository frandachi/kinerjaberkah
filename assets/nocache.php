<?php
/**
 * Serve UI assets with no-store.
 * Prefers ../asset-files (prod layout); falls back to this directory (local).
 */
$f = isset($_GET['f']) ? (string) $_GET['f'] : '';
$f = str_replace(["\0", '\\'], '', $f);
$f = ltrim($f, '/');
if ($f === '' || strpos($f, '..') !== false) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Bad request';
    exit;
}

$candidates = [];
$storePref = realpath(__DIR__ . '/../asset-files');
if ($storePref !== false) $candidates[] = $storePref;
$self = realpath(__DIR__);
if ($self !== false) $candidates[] = $self;

$path = false;
$store = false;
foreach ($candidates as $root) {
    $try = realpath($root . DIRECTORY_SEPARATOR . $f);
    if ($try !== false && strpos($try, $root . DIRECTORY_SEPARATOR) === 0 && is_file($try)) {
        $path = $try;
        $store = $root;
        break;
    }
}
if ($path === false) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found';
    exit;
}

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$types = [
    'js' => 'application/javascript; charset=utf-8',
    'mjs' => 'application/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8',
    'map' => 'application/json; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'svg' => 'image/svg+xml',
    'woff' => 'font/woff',
    'woff2' => 'font/woff2',
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'ico' => 'image/x-icon',
];

header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-KB-Cache: off');
header('X-Content-Type-Options: nosniff');
readfile($path);
