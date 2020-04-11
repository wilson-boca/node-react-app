import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';
import settings from '../../config/settings';
import Queue from '../../lib/Queue';
import cancellationMail from '../jobs/CancellationMail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;
    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: settings.pageSize,
      offset: (page - 1) * settings.pageSize,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      res.status(401).json({ error: 'It is not yours man...' });
    }

    const dateWithSub = subHours(appointment.date, 2);
    if (isBefore(dateWithSub, new Date())) {
      res
        .status(401)
        .json({ error: 'Really sorry, two hours in advance remember?' });
    }

    appointment.canceled_at = new Date();
    await appointment.save();

    await Queue.add(cancellationMail.key, {
      appointment,
    });

    // const formattedDate = format(
    //   appointment.date,
    //   "'dia' dd 'de ' MMMM', às' H:mm'h'",
    //   {
    //     locale: pt,
    //   }
    // );

    // await Mail.sendmail({
    //   to: `${appointment.provider.name} <wilson.boca@gmail.com>`,
    //   subject: 'Agendamento Cancelado',
    //   template: 'cancellation',
    //   context: {
    //     provider: appointment.provider.name,
    //     name: appointment.user.name,
    //     date: formattedDate,
    //   },
    // });

    res.json(appointment);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { provider_id, date } = req.body;

    if (provider_id === req.userId) {
      res
        .status(400)
        .json({ error: "I know that you like yourself but you can't be both" });
    }

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      res.status(400).json({ error: 'User is not a provider' });
    }

    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past date is not allowed' });
    }

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({ error: 'Already taken' });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      "'dia' dd 'de ' MMMM', às' H:mm'h'",
      {
        locale: pt,
      }
    );

    await Notification.create({
      content: `Novo agendamento para ${user.name} para ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
