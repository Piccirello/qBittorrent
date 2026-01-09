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

#pragma once

#include <QHash>
#include <QObject>
#include <QSet>

#include "base/path.h"

namespace Net
{
    struct DownloadResult;
}

class FaviconCache final : public QObject
{
    Q_OBJECT
    Q_DISABLE_COPY_MOVE(FaviconCache)

public:
    explicit FaviconCache(QObject *parent = nullptr);
    ~FaviconCache() override;

    // Returns cached favicon data, or empty QByteArray if not cached
    QByteArray getFavicon(const QString &trackerHost) const;

    // Check if currently downloading or recently failed
    bool isDownloading(const QString &trackerHost) const;
    bool hasRecentlyFailed(const QString &trackerHost) const;

    // Start download (async, emits faviconReady when done)
    void downloadFavicon(const QString &trackerHost);

signals:
    void faviconReady(const QString &trackerHost, const QByteArray &data);
    void faviconFailed(const QString &trackerHost);

private slots:
    void handleFaviconDownloadFinished(const Net::DownloadResult &result);

private:
    // Following GUI pattern (trackersfilterwidget.cpp)
    QString getFaviconHost(const QString &trackerHost) const;
    void startDownload(const QString &trackerHost, const QString &faviconURL);
    bool isValidImageData(const QByteArray &data) const;

    QHash<QString, Path> m_faviconPaths;              // host -> file path on disk
    QHash<QString, qint64> m_failureCache;            // host -> failure timestamp
    QHash<QString, QSet<QString>> m_downloadingFavicons;  // URL -> tracker hosts
    PathList m_iconPaths;                             // all downloaded paths for cleanup
    static constexpr qint64 FAILURE_CACHE_SECS = 300;   // 5 min negative cache
    static constexpr qint64 MAX_FAVICON_SIZE = 102400;  // 100 KB max favicon size
};
