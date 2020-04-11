import pt from 'date-fns/locale/pt';
import { format, parseISO } from 'date-fns';
import Mail from '../../lib/Mail';

class CancellationMail {
  get key() {
    return 'CancellationMail';
  }

  async handle({ data }) {
    const { appointment } = data;
    const formattedDate = format(
      parseISO(appointment.date),
      "'dia' dd 'de ' MMMM', às' H:mm'h'",
      {
        locale: pt,
      }
    );

    console.log('Starting job...');
    await Mail.sendmail({
      to: `${appointment.provider.name} <wilson.boca@gmail.com>`,
      subject: 'Agendamento Cancelado',
      template: 'cancellation',
      context: {
        provider: appointment.provider.name,
        name: appointment.user.name,
        date: formattedDate,
      },
    });
    console.log('Job finished');
  }
}

export default new CancellationMail();
