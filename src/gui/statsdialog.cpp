/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2013  Nick Tiskov <daymansmail@gmail.com>
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

#include "statsdialog.h"

#include "base/bittorrent/cachestatus.h"
#include "base/bittorrent/session.h"
#include "base/bittorrent/sessionstatus.h"
#include "base/bittorrent/torrenthandle.h"
#include "base/utils/misc.h"
#include "base/utils/string.h"
#include "ui_statsdialog.h"
#include "utils.h"

StatsDialog::StatsDialog(QWidget *parent)
    : QDialog(parent)
    , m_ui(new Ui::StatsDialog)
{
    m_ui->setupUi(this);
    setAttribute(Qt::WA_DeleteOnClose);
    connect(m_ui->buttonBox, &QDialogButtonBox::accepted, this, &StatsDialog::close);

    update();
    connect(BitTorrent::Session::instance(), &BitTorrent::Session::statsUpdated
            , this, &StatsDialog::update);

    Utils::Gui::resize(this);
    show();
}

StatsDialog::~StatsDialog()
{
    delete m_ui;
}

void StatsDialog::update()
{
    const auto stats = BitTorrent::Session::instance()->getOrganizedStats();

    // All-time DL/UL
    m_ui->labelAlltimeDL->setText(Utils::Misc::friendlyUnit(stats.allTimeDownload));
    m_ui->labelAlltimeUL->setText(Utils::Misc::friendlyUnit(stats.allTimeUpload));
    // Total waste (this session)
    m_ui->labelWaste->setText(Utils::Misc::friendlyUnit(stats.totalWasted));
    // Global ratio
    m_ui->labelGlobalRatio->setText(stats.globalRatio);
    // Total connected peers
    m_ui->labelPeers->setText(QString::number(stats.peersCount));
    // Cache hits
    m_ui->labelCacheHits->setText(stats.readCacheHits);
    // Buffers size
    m_ui->labelTotalBuf->setText(Utils::Misc::friendlyUnit(stats.totalUsedBuffers));
    // Disk overload (100%) equivalent
    // From lt manual: disk_write_queue and disk_read_queue are the number of peers currently waiting on a disk write or disk read
    // to complete before it receives or sends any more data on the socket. It's a metric of how disk bound you are.

    m_ui->labelWriteStarve->setText(stats.writeCacheOverload);
    m_ui->labelReadStarve->setText(stats.readCacheOverload);
    // Disk queues
    m_ui->labelQueuedJobs->setText(QString::number(stats.jobQueueLength));
    m_ui->labelJobsTime->setText(tr("%1 ms", "18 milliseconds").arg(stats.averageJobTime));
    m_ui->labelQueuedBytes->setText(Utils::Misc::friendlyUnit(stats.queuedBytes));

}
