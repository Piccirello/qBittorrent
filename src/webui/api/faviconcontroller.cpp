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

#include "faviconcontroller.h"

#include <QHostAddress>
#include <QRegularExpression>

#include "base/global.h"
#include "base/http/types.h"
#include "webui/faviconcache.h"
#include "apierror.h"

namespace
{
    // MIME types for images
    const QString CONTENT_TYPE_ICO = u"image/x-icon"_s;
    const QString CONTENT_TYPE_JPEG = u"image/jpeg"_s;

    QString detectMimeType(const QByteArray &data)
    {
        if (data.isEmpty())
            return {};

        // Check magic bytes to determine MIME type
        if (data.startsWith(QByteArray::fromHex("00000100")))
            return CONTENT_TYPE_ICO;
        if (data.startsWith(QByteArray::fromHex("89504E47")))
            return Http::CONTENT_TYPE_PNG;
        if (data.startsWith("GIF8"))
            return Http::CONTENT_TYPE_GIF;
        if (data.startsWith(QByteArray::fromHex("FFD8FF")))
            return CONTENT_TYPE_JPEG;

        // Default to ICO for unknown
        return CONTENT_TYPE_ICO;
    }

    bool isValidTrackerHost(const QString &host)
    {
        if (host.isEmpty())
            return false;

        // Must not contain path separators or dangerous characters
        if (host.contains(u'/') || host.contains(u'\\') || host.contains(u':'))
            return false;

        // IP address is valid
        if (!QHostAddress(host).isNull())
            return true;

        // Domain name validation: alphanumeric, dots, and hyphens
        static const QRegularExpression domainRegex(
            u"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$"_s);
        return domainRegex.match(host).hasMatch();
    }
}

FaviconController::FaviconController(FaviconCache *faviconCache, IApplication *app, QObject *parent)
    : APIController(app, parent)
    , m_faviconCache {faviconCache}
{
}

void FaviconController::indexAction()
{
    const QString host = params()[u"host"_s];

    // Validate host parameter to prevent SSRF
    if (!isValidTrackerHost(host))
        throw APIError(APIErrorType::BadParams, tr("Invalid host parameter"));

    // Try to get cached favicon
    const QByteArray faviconData = m_faviconCache->getFavicon(host);

    if (!faviconData.isEmpty())
    {
        // Cache hit - return the favicon
        const QString mimeType = detectMimeType(faviconData);
        setResult(faviconData, mimeType);
        return;
    }

    // Check if recently failed
    if (m_faviconCache->hasRecentlyFailed(host))
        throw APIError(APIErrorType::NotFound, tr("Favicon not available"));

    // Check if currently downloading
    if (m_faviconCache->isDownloading(host))
    {
        // Return 202 Accepted to indicate download in progress
        // Client should retry after a short delay
        throw APIError(APIErrorType::Conflict, tr("Favicon download in progress"));
    }

    // Start async download
    m_faviconCache->downloadFavicon(host);

    // Return 202 Accepted - client should retry
    throw APIError(APIErrorType::Conflict, tr("Favicon download started"));
}
