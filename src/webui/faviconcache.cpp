/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2026  Thomas Piccirello <thomas@piccirello.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * In addition, as a special exception, the copyright holders give permission to
 * link this program with the OpenSSL project's "OpenSSL" library (or with
 * modified versions of it that use the same license as the "OpenSSL" library),
 * and distribute the linked executables. You must obey the GNU General Public
 * License in all respects for all of the code used other than "OpenSSL".  If you
 * modify file(s), you may extend this exception to your version of the file(s),
 * but you are not obligated to do so. If you do not wish to do so, delete this
 * exception statement from your version.
 */

#include "faviconcache.h"

#include <QDateTime>
#include <QHostAddress>

#include "base/global.h"
#include "base/net/downloadmanager.h"
#include "base/preferences.h"
#include "base/utils/fs.h"
#include "base/utils/io.h"

FaviconCache::FaviconCache(QObject *parent)
    : QObject(parent)
{
}

FaviconCache::~FaviconCache()
{
    for (const Path &iconPath : asConst(m_iconPaths))
        Utils::Fs::removeFile(iconPath);
}

QByteArray FaviconCache::getFavicon(const QString &trackerHost) const
{
    const auto it = m_faviconPaths.find(trackerHost);
    if (it == m_faviconPaths.end())
        return {};

    return Utils::IO::readFile(it.value(), MAX_FAVICON_SIZE).value_or(QByteArray{});
}

bool FaviconCache::isDownloading(const QString &trackerHost) const
{
    for (const auto &hosts : asConst(m_downloadingFavicons))
    {
        if (hosts.contains(trackerHost))
            return true;
    }
    return false;
}

bool FaviconCache::hasRecentlyFailed(const QString &trackerHost) const
{
    const auto it = m_failureCache.find(trackerHost);
    if (it == m_failureCache.end())
        return false;

    const qint64 now = QDateTime::currentSecsSinceEpoch();
    return (now - it.value()) < FAILURE_CACHE_SECS;
}

void FaviconCache::downloadFavicon(const QString &trackerHost)
{
    if (m_faviconPaths.contains(trackerHost))
        return;  // Already cached

    if (hasRecentlyFailed(trackerHost))
        return;  // Recently failed

    if (isDownloading(trackerHost))
        return;  // Already downloading

    // Use HTTP as default - GUI uses tracker's scheme if http/https, otherwise falls back to http
    // Since we only have hostname (not full tracker URL), we use http like GUI's fallback
    const QString faviconURL = u"http://%1/favicon.ico"_s.arg(getFaviconHost(trackerHost));
    startDownload(trackerHost, faviconURL);
}

QString FaviconCache::getFaviconHost(const QString &trackerHost) const
{
    if (!QHostAddress(trackerHost).isNull())
        return trackerHost;  // IP address - use directly

    return trackerHost.section(u'.', -2, -1);  // Extract base domain
}

void FaviconCache::startDownload(const QString &trackerHost, const QString &faviconURL)
{
    QSet<QString> &downloadingNode = m_downloadingFavicons[faviconURL];
    if (downloadingNode.isEmpty())
    {
        Net::DownloadManager::instance()->download(
            Net::DownloadRequest(faviconURL).saveToFile(true),
            Preferences::instance()->useProxyForGeneralPurposes(),
            this, &FaviconCache::handleFaviconDownloadFinished);
    }
    downloadingNode.insert(trackerHost);
}

void FaviconCache::handleFaviconDownloadFinished(const Net::DownloadResult &result)
{
    const QSet<QString> trackerHosts = m_downloadingFavicons.take(result.url);
    if (trackerHosts.isEmpty()) [[unlikely]]
        return;

    bool failed = (result.status != Net::DownloadStatus::Success);
    if (!failed)
    {
        // Validate image data
        const QByteArray data = Utils::IO::readFile(result.filePath, MAX_FAVICON_SIZE).value_or(QByteArray{});
        if (!isValidImageData(data))
        {
            Utils::Fs::removeFile(result.filePath);
            failed = true;
        }
    }

    if (failed)
    {
        // Fallback .ico → .png (same as GUI lines 495-503)
        if (result.url.endsWith(u".ico", Qt::CaseInsensitive))
        {
            const QString pngURL = QStringView(result.url).chopped(4) + u".png";
            for (const QString &host : trackerHosts)
                startDownload(host, pngURL);
            return;
        }

        // Both failed - cache failure
        const qint64 now = QDateTime::currentSecsSinceEpoch();
        for (const QString &host : trackerHosts)
        {
            m_failureCache[host] = now;
            emit faviconFailed(host);
        }
        return;
    }

    // Success - store path and emit signal
    m_iconPaths.append(result.filePath);
    const QByteArray data = Utils::IO::readFile(result.filePath, MAX_FAVICON_SIZE).value_or(QByteArray{});
    for (const QString &host : trackerHosts)
    {
        m_faviconPaths[host] = result.filePath;
        emit faviconReady(host, data);
    }
}

bool FaviconCache::isValidImageData(const QByteArray &data) const
{
    if (data.isEmpty())
        return false;

    // Check for common image magic bytes
    // ICO: 00 00 01 00
    if (data.startsWith(QByteArray::fromHex("00000100")))
        return true;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (data.startsWith(QByteArray::fromHex("89504E47")))
        return true;
    // GIF: 47 49 46 38
    if (data.startsWith("GIF8"))
        return true;
    // JPEG: FF D8 FF
    if (data.startsWith(QByteArray::fromHex("FFD8FF")))
        return true;
    // BMP: 42 4D
    if (data.startsWith("BM"))
        return true;
    // WebP: RIFF....WEBP
    if (data.startsWith("RIFF") && (data.size() >= 12) && (data.mid(8, 4) == "WEBP"))
        return true;

    return false;
}
