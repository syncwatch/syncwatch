module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: false,
        title: 'Room',
        path: '/room/:id',
        cb: (req, res) => {
          res.render('player', server.helpers.getRenderInfo(server.pages, req, { room_id: req.params.id }))
        }
      };
};
