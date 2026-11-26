<?php
/**
 * HTML entry with forced no-cache (hosting applies max-age=300 on raw index.html).
 */
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-KB-Cache: off');
readfile(__DIR__ . '/index.html');
