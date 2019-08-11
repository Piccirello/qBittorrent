/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2018  Vladimir Golovnev <glassez@yandex.ru>
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

#include "authcontroller.h"

#include <QString>

#include "base/logger.h"
#include "apierror.h"
#include "isessionmanager.h"
#include "webauth.h"

void AuthController::loginAction()
{
    if (sessionManager()->session()) {
        setResult(QLatin1String("Ok."));
        return;
    }

    const QString clientAddr {sessionManager()->clientId()};
    const QString usernameFromWeb {params()["username"]};
    const QString passwordFromWeb {params()["password"]};
    const QString token {params()["token"]};

    WebAuth *const webAuth = WebAuth::instance();
    if (webAuth->isBanned(clientAddr)) {
        LogMsg(tr("WebAPI login failure. Reason: IP has been banned, IP: %1, username: %2")
                .arg(clientAddr, usernameFromWeb)
            , Log::WARNING);
        throw APIError(APIErrorType::AccessDenied
                       , tr("Your IP address has been banned after too many failed authentication attempts."));
    }

    const bool useUserAuth = (!usernameFromWeb.isNull() && !passwordFromWeb.isNull());
    const bool useTokenAuth = !token.isNull();
    const bool userAuthenticated = (useUserAuth ? webAuth->isUserAuthValid(usernameFromWeb, passwordFromWeb) : false);
    const bool tokenAuthenticated = ((!userAuthenticated && useTokenAuth) ? webAuth->isTokenValid(token) : false);

    if (userAuthenticated || tokenAuthenticated) {
        webAuth->clearFailedAttempts(clientAddr);

        if (userAuthenticated)
            sessionManager()->sessionStart();
        else
            sessionManager()->sessionStart(token);

        setResult(QLatin1String("Ok."));
        LogMsg(tr("WebAPI login success. Credentials: %1, IP: %2")
            .arg(userAuthenticated ? "user" : "token", clientAddr));
    }
    else {
        webAuth->increaseFailedAttempts(clientAddr);
        setResult(QLatin1String("Fails."));
        LogMsg(tr("WebAPI login failure. Reason: invalid credentials, attempt count: %1, IP: %2, username: %3")
                .arg(QString::number(webAuth->failedAttemptsCount(clientAddr)), clientAddr, usernameFromWeb)
            , Log::WARNING);
    }
}

void AuthController::logoutAction()
{
    sessionManager()->sessionEnd();
}
